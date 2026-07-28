import {
	SendTemplatedEmailCommand,
	SendTemplatedEmailCommandOutput,
	SESClient,
	SESClientConfig,
} from '@aws-sdk/client-ses';
import type {
	DocumentReference,
	DocumentSnapshot,
	QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import {
	COLLECTION_SCHEMA,
	EMAIL_TEMPLATE_KEYS,
	Registration,
} from '../models';
import admin from '../firebase-admin';
import {
	EVENT_DISPLAY_NAME,
	getRegistrationQrCodeUrl,
	REMINDER_EMAIL_SENDING_STALE_MINUTES,
	REGISTRATION_EMAIL_RETURN_PATH,
	REGISTRATION_EMAIL_SOURCE,
	REGISTRATION_EMAIL_TEMPLATE,
	SES_REGION,
} from '../utility/runtime-config';
import {
	buildEmailTemplateDataFromMappings,
	resolvePublishedEmailTemplate,
} from '../utility/email-templates';
import { serializeError } from '../utility/errors';
import {
	normalizeDateTime,
	type DateTimeValue,
} from '../utility/date-time-format';

const credentials = {
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
let sesClient: SESClient | undefined = undefined;

interface QueuedRegistrationEmailDocument {
	code?: string;
	name?: string;
	email?: string;
	formattedDateTime?: string;
	template?: string;
	templateKey?: string;
	queuedOn?: Date;
	queueSource?: string;
	deliveryRequestedOn?: Date;
	deliveryAttemptedOn?: Date;
	deliveryCompletedOn?: Date;
	deliveryState?: 'queued' | 'sending' | 'sent' | 'failed';
	failedOn?: Date;
	lastErrorMessage?: string;
	lastErrorDetails?: string;
}

interface LoadedEmailTriggerContext {
	triggeredSnapshot: QueryDocumentSnapshot;
	emailDocRef: DocumentReference;
	registrationDocRef: DocumentReference;
	currentEmailDoc: DocumentSnapshot;
	document: QueuedRegistrationEmailDocument;
	registration?: Registration;
}

interface ResolvedEmailPayload {
	uid: string;
	email: string;
	firstName: string;
	dateTime: string;
	code: string;
	template?: string;
	templateKey?: string;
}

const queueProcessingState = {
	sending: 'sending',
	sent: 'sent',
	failed: 'failed',
} as const;

const buildSuccessfulDeliveryUpdates = (sentOn: Date) => ({
	registration: {
		reminderEmailSentOn: sentOn,
		reminderEmailFailedOn: false,
	},
	queue: {
		deliveryState: queueProcessingState.sent,
		deliveryAttemptedOn: sentOn,
		deliveryCompletedOn: sentOn,
		failedOn: false,
		lastErrorMessage: false,
		lastErrorDetails: false,
	},
});

const getQueueRequestedOn = (
	document: QueuedRegistrationEmailDocument,
	fallback: Date,
): Date => {
	const requestedOn = document.deliveryRequestedOn ?? document.queuedOn;

	if (!requestedOn) {
		return fallback;
	}

	return normalizeDateTime(requestedOn as DateTimeValue);
};

const getNormalizedDate = (value: Date | undefined, fallback: Date): Date => {
	if (!value) {
		return fallback;
	}

	return normalizeDateTime(value as DateTimeValue);
};

const shouldSendQueuedDocument = (
	document: QueuedRegistrationEmailDocument | undefined,
): document is QueuedRegistrationEmailDocument => {
	if (!document) {
		return false;
	}

	return (
		document.deliveryState === undefined ||
		document.deliveryState === 'queued'
	);
};

const isStaleSendingDocument = (
	document: QueuedRegistrationEmailDocument,
	now: Date,
): boolean => {
	if (document.deliveryState !== queueProcessingState.sending) {
		return false;
	}

	const attemptedOn = document.deliveryAttemptedOn;
	if (!attemptedOn) {
		return true;
	}

	const attemptedDate = normalizeDateTime(attemptedOn as DateTimeValue);

	const staleThresholdMs = REMINDER_EMAIL_SENDING_STALE_MINUTES * 60 * 1000;
	return now.getTime() - attemptedDate.getTime() >= staleThresholdMs;
};

const repairRegistrationStatus = async (
	registrationDocRef: FirestoreDocumentReferenceLike,
	registration: Registration | undefined,
	document: QueuedRegistrationEmailDocument,
): Promise<void> => {
	if (document.deliveryState !== queueProcessingState.sent) {
		return;
	}

	if (registration?.reminderEmailSentOn) {
		return;
	}

	const sentOn = getNormalizedDate(document.deliveryCompletedOn, new Date());
	await registrationDocRef.set(
		{
			reminderEmailQueuedOn: getQueueRequestedOn(document, sentOn),
			reminderEmailSentOn: sentOn,
			reminderEmailFailedOn: false,
		},
		{ merge: true },
	);
};

const buildFailedDeliveryUpdates = (failedOn: Date, error: unknown) => ({
	registration: {
		reminderEmailFailedOn: failedOn,
	},
	queue: {
		deliveryState: queueProcessingState.failed,
		deliveryAttemptedOn: failedOn,
		failedOn,
		lastErrorMessage:
			error instanceof Error ? error.message : String(error),
		lastErrorDetails: serializeError(error),
	},
});

const createReminderEmailCommand = (
	messageDetails: Record<string, string>,
	toEmailAddress: string,
	template = REGISTRATION_EMAIL_TEMPLATE,
): SendTemplatedEmailCommand => {
	return new SendTemplatedEmailCommand({
		Destination: { ToAddresses: [toEmailAddress] },
		TemplateData: JSON.stringify(messageDetails),
		Source: REGISTRATION_EMAIL_SOURCE,
		Template: template,
		ReturnPath: REGISTRATION_EMAIL_RETURN_PATH,
	});
};

const loadEmailTriggerContext = async (
	triggeredSnapshot: QueryDocumentSnapshot,
): Promise<LoadedEmailTriggerContext | undefined> => {
	const triggeredData = triggeredSnapshot.data() as
		| QueuedRegistrationEmailDocument
		| undefined;
	if (!triggeredData) {
		return undefined;
	}

	const emailDocRef = admin
		.firestore()
		.doc(
			`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${triggeredSnapshot.id}`,
		);
	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${triggeredSnapshot.id}`);
	const currentEmailDoc = await emailDocRef.get();
	const document = (
		currentEmailDoc.exists ? currentEmailDoc.data() : triggeredData
	) as QueuedRegistrationEmailDocument;
	const registrationSnapshot = await registrationDocRef.get();
	const registration = registrationSnapshot.exists
		? (registrationSnapshot.data() as Registration)
		: undefined;

	return {
		triggeredSnapshot,
		emailDocRef,
		registrationDocRef,
		currentEmailDoc,
		document,
		registration,
	};
};

const syncSentQueueDocument = async (
	context: LoadedEmailTriggerContext,
	sentOn: Date,
): Promise<void> => {
	if (!context.currentEmailDoc.exists) {
		return;
	}

	await context.emailDocRef.set(
		{
			deliveryState: queueProcessingState.sent,
			deliveryCompletedOn: sentOn,
			queuedOn: getQueueRequestedOn(context.document, sentOn),
			deliveryRequestedOn: getQueueRequestedOn(context.document, sentOn),
			failedOn: false,
			lastErrorMessage: false,
			lastErrorDetails: false,
		},
		{ merge: true },
	);
};

const canSkipDelivery = async (
	context: LoadedEmailTriggerContext,
): Promise<boolean> => {
	const now = new Date();

	if (context.registration?.reminderEmailSentOn) {
		await syncSentQueueDocument(
			context,
			getNormalizedDate(context.registration.reminderEmailSentOn, now),
		);
		return true;
	}

	if (context.document.deliveryState === queueProcessingState.sent) {
		await repairRegistrationStatus(
			context.registrationDocRef,
			context.registration,
			context.document,
		);
		return true;
	}

	if (
		context.document.deliveryState === queueProcessingState.sending &&
		!isStaleSendingDocument(context.document, now)
	) {
		return true;
	}

	if (isStaleSendingDocument(context.document, now)) {
		await context.emailDocRef.set(
			{
				deliveryState: 'queued',
				failedOn: false,
				lastErrorMessage: false,
				lastErrorDetails: false,
			},
			{ merge: true },
		);
		context.document.deliveryState = 'queued';
	}

	return !shouldSendQueuedDocument(context.document);
};

const resolveEmailPayload = (
	context: LoadedEmailTriggerContext,
): ResolvedEmailPayload | undefined => {
	const { document, triggeredSnapshot } = context;
	if (
		!document.code ||
		!document.name ||
		!document.email ||
		!document.formattedDateTime
	) {
		console.warn(
			`Skipping registration email for ${triggeredSnapshot.id} because the queued document is incomplete.`,
		);
		return undefined;
	}

	return {
		uid: triggeredSnapshot.id,
		email: document.email,
		firstName: document.name,
		dateTime: document.formattedDateTime,
		code: document.code,
		...(document.template ? { template: document.template } : {}),
		...(document.templateKey
			? { templateKey: document.templateKey }
			: { templateKey: EMAIL_TEMPLATE_KEYS.registrationConfirmation }),
	};
};

const markQueueSending = async (
	context: LoadedEmailTriggerContext,
	attemptedOn: Date,
): Promise<void> => {
	await context.emailDocRef.set(
		{
			deliveryState: queueProcessingState.sending,
			deliveryAttemptedOn: attemptedOn,
		},
		{ merge: true },
	);
};

const persistSuccessfulDelivery = async (
	context: LoadedEmailTriggerContext,
	queuedOn: Date,
	sentOn: Date,
): Promise<void> => {
	const successUpdates = buildSuccessfulDeliveryUpdates(sentOn);
	let queueWriteError: unknown;
	try {
		await context.emailDocRef.set(
			{
				...successUpdates.queue,
				queuedOn,
				deliveryRequestedOn: queuedOn,
			},
			{ merge: true },
		);
	} catch (error) {
		queueWriteError = error;
	}

	let registrationWriteError: unknown;
	try {
		await context.registrationDocRef.set(
			{
				...successUpdates.registration,
				reminderEmailQueuedOn: queuedOn,
			},
			{ merge: true },
		);
	} catch (error) {
		registrationWriteError = error;
	}

	if (!queueWriteError && !registrationWriteError) {
		return;
	}

	if (!queueWriteError || !registrationWriteError) {
		throw registrationWriteError ?? queueWriteError;
	}

	throw queueWriteError;
};

const persistFailedDelivery = async (
	context: LoadedEmailTriggerContext,
	queuedOn: Date,
	response: SendTemplatedEmailCommandOutput | undefined,
	error: unknown,
): Promise<void> => {
	if (response) {
		throw error instanceof Error
			? error
			: new Error(
					'Failed to persist successful queued registration email delivery',
				);
	}

	const failedOn = new Date();
	const failedUpdates = buildFailedDeliveryUpdates(failedOn, error);
	await context.emailDocRef.set(
		{
			...failedUpdates.queue,
			queuedOn,
			deliveryRequestedOn: queuedOn,
			rejected: response,
		},
		{ merge: true },
	);
	await context.registrationDocRef.set(failedUpdates.registration, {
		merge: true,
	});
	throw error instanceof Error
		? error
		: new Error('Failed to send queued registration email');
};

export default async function sendNewRegistrationEmails2(
	triggeredSnapshot: QueryDocumentSnapshot,
): Promise<void> {
	const context = await loadEmailTriggerContext(triggeredSnapshot);
	if (!context) {
		return;
	}

	if (await canSkipDelivery(context)) {
		return;
	}

	const payload = resolveEmailPayload(context);
	if (!payload) {
		return;
	}

	const baseMessageDetails = {
		firstName: payload.firstName,
		eventName: EVENT_DISPLAY_NAME,
		qrCodeUrl: getRegistrationQrCodeUrl(payload.uid),
		code: payload.code,
		dateTime: payload.dateTime,
	};

	sesClient ??= new SESClient({
		credentials,
		region: SES_REGION,
	} as SESClientConfig);

	const resolvedTemplate = await resolvePublishedEmailTemplate(
		{
			...(payload.template ? { template: payload.template } : {}),
			...(payload.templateKey ? { templateKey: payload.templateKey } : {}),
		},
		REGISTRATION_EMAIL_TEMPLATE,
	);

	const messageDetails = resolvedTemplate.templateSummary
		? buildEmailTemplateDataFromMappings(
				resolvedTemplate.templateSummary.fieldMappings,
				baseMessageDetails,
			)
		: baseMessageDetails;

	const sendReminderEmailCommand = createReminderEmailCommand(
		messageDetails,
		payload.email,
		resolvedTemplate.templateName,
	);

	let response: SendTemplatedEmailCommandOutput | undefined;
	const attemptedOn = new Date();
	const queuedOn = getQueueRequestedOn(context.document, attemptedOn);

	await markQueueSending(context, attemptedOn);

	try {
		response = await sesClient.send(sendReminderEmailCommand);
		const sentOn = new Date();
		console.log('Successfully sent template email', response);
		await persistSuccessfulDelivery(context, queuedOn, sentOn);
	} catch (err) {
		console.log('Failed to send template email', err);
		await persistFailedDelivery(context, queuedOn, response, err);
	}
}
