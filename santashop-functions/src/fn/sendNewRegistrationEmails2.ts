import {
	SendEmailCommand,
	type SendEmailCommandOutput,
	SendTemplatedEmailCommand,
	type SendTemplatedEmailCommandOutput,
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
import { createFunctionLogger } from '../utility/observability';
import {
	normalizeDateTime,
	type DateTimeValue,
} from '../utility/date-time-format';

const log = createFunctionLogger('sendNewRegistrationEmails2');

const credentials = {
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
let sesClient: SESClient | undefined = undefined;

interface EmailTriggerMetadata {
	eventId?: string;
}

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
	deliveryAttemptEventId?: string;
	deliveryAttemptCount?: number;
	deliveryProviderAcceptedOn?: Date;
	deliveryProviderMessageId?: string;
	deliveryRequiresReviewOn?: Date;
	deliveryRequiresReviewReason?: string;
	deliveryCompletedOn?: Date;
	deliveryState?: 'queued' | 'sending' | 'accepted' | 'sent' | 'failed';
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

interface EmailDeliveryResponse {
	MessageId?: string;
	$metadata?: { httpStatusCode?: number };
}

const queueProcessingState = {
	sending: 'sending',
	accepted: 'accepted',
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
		deliveryRequiresReviewOn: false,
		deliveryRequiresReviewReason: false,
		lastErrorMessage: false,
		lastErrorDetails: false,
	},
});

const isCancellationCommunication = (
	document: QueuedRegistrationEmailDocument,
): boolean => document.queueSource === 'registration-cancellation';

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

const getSuccessfulDeliveryDate = (
	document: QueuedRegistrationEmailDocument,
	fallback: Date,
): Date => {
	return getNormalizedDate(
		document.deliveryCompletedOn ?? document.deliveryProviderAcceptedOn,
		fallback,
	);
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

const hasAcceptedExternalDelivery = (
	document: QueuedRegistrationEmailDocument,
): boolean => {
	return Boolean(
		document.deliveryProviderMessageId ||
		document.deliveryState === queueProcessingState.accepted,
	);
};

const repairRegistrationStatus = async (
	registrationDocRef: DocumentReference,
	registration: Registration | undefined,
	document: QueuedRegistrationEmailDocument,
): Promise<void> => {
	if (
		document.deliveryState !== queueProcessingState.sent &&
		!hasAcceptedExternalDelivery(document)
	) {
		return;
	}

	if (registration?.reminderEmailSentOn) {
		return;
	}

	const sentOn = getSuccessfulDeliveryDate(document, new Date());
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

const createCancellationEmailCommand = (
	payload: ResolvedEmailPayload,
): SendEmailCommand =>
	new SendEmailCommand({
		Destination: { ToAddresses: [payload.email] },
		Source: REGISTRATION_EMAIL_SOURCE,
		ReturnPath: REGISTRATION_EMAIL_RETURN_PATH,
		Message: {
			Subject: {
				Data: `Your ${EVENT_DISPLAY_NAME} registration was cancelled`,
			},
			Body: {
				Text: {
					Data: `Hello ${payload.firstName},\n\nYour registration for ${EVENT_DISPLAY_NAME} has been cancelled. Your previous appointment (${payload.dateTime}) is no longer reserved, and the confirmation code from your cancelled registration is no longer valid.\n\nIf you would like to attend, sign in and submit a new registration.`,
				},
			},
		},
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

const persistDeliveryReviewRequirement = async (
	context: LoadedEmailTriggerContext,
	reviewedOn: Date,
	reason: string,
): Promise<void> => {
	await context.emailDocRef.set(
		{
			deliveryRequiresReviewOn: reviewedOn,
			deliveryRequiresReviewReason: reason,
			lastErrorMessage: reason,
			lastErrorDetails: false,
		},
		{ merge: true },
	);
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
			deliveryProviderAcceptedOn:
				context.document.deliveryProviderAcceptedOn ?? sentOn,
			deliveryProviderMessageId:
				context.document.deliveryProviderMessageId ?? false,
			deliveryCompletedOn: sentOn,
			queuedOn: getQueueRequestedOn(context.document, sentOn),
			deliveryRequestedOn: getQueueRequestedOn(context.document, sentOn),
			failedOn: false,
			deliveryRequiresReviewOn: false,
			deliveryRequiresReviewReason: false,
			lastErrorMessage: false,
			lastErrorDetails: false,
		},
		{ merge: true },
	);
};

const canSkipDelivery = async (
	context: LoadedEmailTriggerContext,
	triggerMetadata: EmailTriggerMetadata,
): Promise<boolean> => {
	const now = new Date();

	if (
		!isCancellationCommunication(context.document) &&
		context.registration?.reminderEmailSentOn
	) {
		await syncSentQueueDocument(
			context,
			getNormalizedDate(context.registration.reminderEmailSentOn, now),
		);
		return true;
	}

	if (hasAcceptedExternalDelivery(context.document)) {
		const sentOn = getSuccessfulDeliveryDate(context.document, now);
		await syncSentQueueDocument(context, sentOn);
		await repairRegistrationStatus(
			context.registrationDocRef,
			context.registration,
			context.document,
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
		triggerMetadata.eventId &&
		context.document.deliveryState === queueProcessingState.sending &&
		context.document.deliveryAttemptEventId === triggerMetadata.eventId
	) {
		await persistDeliveryReviewRequirement(
			context,
			now,
			'A retry attempted to reuse an in-flight SES delivery claim; automatic resend was skipped to avoid duplicate email delivery.',
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
		log.warn('Skipping incomplete queued registration email document', {
			uid: triggeredSnapshot.id,
			documentKeys: Object.keys(document).sort((left, right) =>
				left.localeCompare(right),
			),
		});
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
	triggerMetadata: EmailTriggerMetadata,
): Promise<void> => {
	await context.emailDocRef.set(
		{
			deliveryState: queueProcessingState.sending,
			deliveryAttemptedOn: attemptedOn,
			deliveryAttemptEventId: triggerMetadata.eventId ?? false,
			deliveryAttemptCount:
				(context.document.deliveryAttemptCount ?? 0) + 1,
			deliveryProviderAcceptedOn: false,
			deliveryProviderMessageId: false,
			deliveryRequiresReviewOn: false,
			deliveryRequiresReviewReason: false,
		},
		{ merge: true },
	);
};

const persistProviderAcceptance = async (
	context: LoadedEmailTriggerContext,
	queuedOn: Date,
	acceptedOn: Date,
	response: EmailDeliveryResponse,
): Promise<void> => {
	await context.emailDocRef.set(
		{
			deliveryState: queueProcessingState.accepted,
			deliveryAttemptedOn: acceptedOn,
			deliveryProviderAcceptedOn: acceptedOn,
			deliveryProviderMessageId: response.MessageId ?? false,
			queuedOn,
			deliveryRequestedOn: queuedOn,
			failedOn: false,
			lastErrorMessage: false,
			lastErrorDetails: false,
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
				deliveryProviderAcceptedOn:
					context.document.deliveryProviderAcceptedOn ?? sentOn,
				deliveryProviderMessageId:
					context.document.deliveryProviderMessageId ?? false,
				queuedOn,
				deliveryRequestedOn: queuedOn,
			},
			{ merge: true },
		);
	} catch (error) {
		queueWriteError = error;
	}

	let registrationWriteError: unknown;
	if (!isCancellationCommunication(context.document)) {
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
	response: EmailDeliveryResponse | undefined,
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
		},
		{ merge: true },
	);
	if (!isCancellationCommunication(context.document)) {
		await context.registrationDocRef.set(failedUpdates.registration, {
			merge: true,
		});
	}
	throw error instanceof Error
		? error
		: new Error('Failed to send queued registration email');
};

export default async function sendNewRegistrationEmails2(
	triggeredSnapshot: QueryDocumentSnapshot,
	triggerMetadata: EmailTriggerMetadata = {},
): Promise<void> {
	const context = await loadEmailTriggerContext(triggeredSnapshot);
	if (!context) {
		return;
	}

	if (await canSkipDelivery(context, triggerMetadata)) {
		return;
	}

	const payload = resolveEmailPayload(context);
	if (!payload) {
		return;
	}

	sesClient ??= new SESClient({
		credentials,
		region: SES_REGION,
	} as SESClientConfig);

	const isCancellation = isCancellationCommunication(context.document);
	let templateName: string | undefined;
	let emailCommand: SendTemplatedEmailCommand | SendEmailCommand;
	if (isCancellation) {
		emailCommand = createCancellationEmailCommand(payload);
	} else {
		const baseMessageDetails = {
			firstName: payload.firstName,
			eventName: EVENT_DISPLAY_NAME,
			qrCodeUrl: getRegistrationQrCodeUrl(payload.uid),
			code: payload.code,
			dateTime: payload.dateTime,
		};
		const resolvedTemplate = await resolvePublishedEmailTemplate(
			{
				...(payload.template ? { template: payload.template } : {}),
				...(payload.templateKey
					? { templateKey: payload.templateKey }
					: {}),
			},
			REGISTRATION_EMAIL_TEMPLATE,
		);
		templateName = resolvedTemplate.templateName;
		const messageDetails = resolvedTemplate.templateSummary
			? buildEmailTemplateDataFromMappings(
					resolvedTemplate.templateSummary.fieldMappings,
					baseMessageDetails,
				)
			: baseMessageDetails;
		emailCommand = createReminderEmailCommand(
			messageDetails,
			payload.email,
			resolvedTemplate.templateName,
		);
	}

	let response: EmailDeliveryResponse | undefined;
	const attemptedOn = new Date();
	const queuedOn = getQueueRequestedOn(context.document, attemptedOn);

	await markQueueSending(context, attemptedOn, triggerMetadata);

	try {
		response = isCancellation
			? ((await sesClient.send(
					emailCommand as SendEmailCommand,
				)) as SendEmailCommandOutput)
			: ((await sesClient.send(
					emailCommand as SendTemplatedEmailCommand,
				)) as SendTemplatedEmailCommandOutput);
		// todo: later, check SES delivery status from AWS for this message ID and
		// update the queue/registration state if delivery is deferred, bounced, or rejected.
		const acceptedOn = new Date();
		await persistProviderAcceptance(
			context,
			queuedOn,
			acceptedOn,
			response,
		);
		context.document.deliveryState = queueProcessingState.accepted;
		context.document.deliveryProviderAcceptedOn = acceptedOn;
		context.document.deliveryProviderMessageId = response.MessageId;
		const sentOn = new Date();
		log.info('Successfully sent queued registration email', {
			uid: payload.uid,
			templateName: templateName ?? 'registration-cancellation',
			templateKey: payload.templateKey ?? null,
			providerMessageId: response.MessageId ?? null,
			httpStatusCode: response.$metadata?.httpStatusCode,
		});
		await persistSuccessfulDelivery(context, queuedOn, sentOn);
	} catch (err) {
		log.error(
			'Failed to send queued registration email',
			{
				uid: payload.uid,
			templateName: templateName ?? 'registration-cancellation',
				templateKey: payload.templateKey ?? null,
			},
			err,
		);
		await persistFailedDelivery(context, queuedOn, response, err);
	}
}
