import {
	customerLanguageOrEnglish,
	type CustomerLanguage,
} from '@santashop/models';
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
import { COLLECTION_SCHEMA, Registration } from '../models';
import admin from '../firebase-admin';
import {
	EVENT_DISPLAY_NAME,
	REMINDER_EMAIL_SENDING_STALE_MINUTES,
	REGISTRATION_EMAIL_RETURN_PATH,
	REGISTRATION_EMAIL_SOURCE,
	SES_REGION,
} from '../utility/runtime-config';
import { getRegistrationQrCodeUrl } from '../utility/qrcodes';
import {
	buildEmailTemplateDataFromMappings,
	getEmailTemplateRevision,
	readEmailTemplateHtml,
	renderTemplateWithFieldValues,
	resolvePublishedEmailTemplate,
} from '../utility/email-templates';
import { isEmailSink, recordSimulatedEmail } from '../utility/email-isolation';
import { serializeError } from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';
import {
	normalizeDateTime,
	formatRegistrationDateTime,
	type DateTimeValue,
} from '../utility/date-time-format';

const log = createFunctionLogger('sendRegistrationEmail');

const credentials = {
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
let sesClient: SESClient | undefined = undefined;

interface EmailTriggerMetadata {
	eventId?: string;
}

interface QueuedRegistrationEmailDocument {
	registrationUid?: string;
	appointmentSlotId?: string;
	cancellationLogId?: string;
	code?: string;
	qrCodeStoragePath?: string;
	name?: string;
	email?: string;
	formattedDateTime?: string;
	appointmentDateTime?: DateTimeValue;
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
	deliveryState?:
		| 'queued'
		| 'sending'
		| 'accepted'
		| 'sent'
		| 'failed'
		| 'superseded'
		| 'simulated';
	failedOn?: Date;
	lastErrorMessage?: string;
	lastErrorDetails?: string;
}

interface LoadedEmailTriggerContext {
	triggeredSnapshot: QueryDocumentSnapshot;
	registrationUid: string;
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
	qrCodeStoragePath?: string;
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
	superseded: 'superseded',
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

const datesMatch = (left: unknown, right: unknown): boolean => {
	if (!left || !right) {
		return false;
	}

	try {
		return (
			normalizeDateTime(left as DateTimeValue).getTime() ===
			normalizeDateTime(right as DateTimeValue).getTime()
		);
	} catch {
		return false;
	}
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
	context: LoadedEmailTriggerContext,
): Promise<void> => {
	const { document } = context;
	if (
		document.deliveryState !== queueProcessingState.sent &&
		!hasAcceptedExternalDelivery(document)
	) {
		return;
	}

	const sentOn = getSuccessfulDeliveryDate(document, new Date());
	await updateRegistrationDeliveryStatusIfCurrent(
		context,
		{
			reminderEmailQueuedOn: getQueueRequestedOn(document, sentOn),
			reminderEmailSentOn: sentOn,
			reminderEmailFailedOn: false,
		},
		true,
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
	messageDetails: Record<string, unknown>,
	toEmailAddress: string,
	template: string,
): SendTemplatedEmailCommand => {
	return new SendTemplatedEmailCommand({
		Destination: { ToAddresses: [toEmailAddress] },
		TemplateData: JSON.stringify(messageDetails),
		Source: REGISTRATION_EMAIL_SOURCE,
		Template: template,
		ReturnPath: REGISTRATION_EMAIL_RETURN_PATH,
	});
};

const createCancellationEmailCommand = (
	payload: ResolvedEmailPayload,
	language: CustomerLanguage = 'en',
): SendEmailCommand =>
	new SendEmailCommand({
		Destination: { ToAddresses: [payload.email] },
		Source: REGISTRATION_EMAIL_SOURCE,
		ReturnPath: REGISTRATION_EMAIL_RETURN_PATH,
		Message: {
			Subject: {
				Charset: 'UTF-8',
				Data:
					language === 'es'
						? `Tu inscripción para ${EVENT_DISPLAY_NAME} fue cancelada`
						: `Your ${EVENT_DISPLAY_NAME} registration was cancelled`,
			},
			Body: {
				Text: {
					Charset: 'UTF-8',
					Data:
						language === 'es'
							? `Hola ${payload.firstName},\n\nTu inscripción para ${EVENT_DISPLAY_NAME} fue cancelada. Tu cita anterior (${payload.dateTime}) ya no está reservada y tu boleto anterior ya no es válido.\n\nSi deseas asistir, inicia sesión y completa una nueva inscripción: https://register.denversantaclausshop.org`
							: `Hello ${payload.firstName},\n\nYour registration for ${EVENT_DISPLAY_NAME} has been cancelled. Your previous appointment (${payload.dateTime}) is no longer reserved, and the confirmation code from your cancelled registration is no longer valid.\n\nIf you would like to attend, sign in and submit a new registration.`,
				},
			},
		},
	});

const loadEmailTriggerContext = async (
	triggeredSnapshot: QueryDocumentSnapshot,
): Promise<LoadedEmailTriggerContext | undefined> => {
	const triggeredData = triggeredSnapshot.data() as
		QueuedRegistrationEmailDocument | undefined;
	if (!triggeredData) {
		return undefined;
	}

	const emailDocRef = admin
		.firestore()
		.doc(
			`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${triggeredSnapshot.id}`,
		);
	const currentEmailDoc = await emailDocRef.get();
	const document = (
		currentEmailDoc.exists ? currentEmailDoc.data() : triggeredData
	) as QueuedRegistrationEmailDocument;
	const registrationUid = document.registrationUid ?? triggeredSnapshot.id;
	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${registrationUid}`);
	const registrationSnapshot = await registrationDocRef.get();
	const registration = registrationSnapshot.exists
		? (registrationSnapshot.data() as Registration)
		: undefined;

	return {
		triggeredSnapshot,
		registrationUid,
		emailDocRef,
		registrationDocRef,
		currentEmailDoc,
		document,
		registration,
	};
};

const getSupersededReason = (
	context: LoadedEmailTriggerContext,
): string | undefined => {
	const { document, registration } = context;
	if (!registration) {
		return 'The registration no longer exists.';
	}
	if (isCancellationCommunication(document)) {
		if (
			!registration.cancelledOn ||
			(document.cancellationLogId &&
				registration.cancellationLogId !== document.cancellationLogId)
		) {
			return 'A newer registration state replaced this cancellation.';
		}
	} else {
		if (!registration.registrationSubmittedOn || registration.cancelledOn) {
			return 'The registration is no longer active.';
		}
		if (
			document.appointmentSlotId &&
			registration.dateTimeSlot?.id !== document.appointmentSlotId
		) {
			return 'A newer appointment replaced this email.';
		}
		if (
			document.registrationUid &&
			(!document.deliveryRequestedOn ||
				!datesMatch(
					document.deliveryRequestedOn,
					registration.reminderEmailQueuedOn,
				))
		) {
			return 'A newer email delivery request replaced this email.';
		}
	}
	if (!document.code || registration.qrcode !== document.code) {
		return 'A newer confirmation code replaced this email.';
	}
	if (
		!document.email ||
		registration.emailAddress?.toLowerCase() !==
			document.email.toLowerCase()
	) {
		return 'The registration email address changed after this email was queued.';
	}
	if (!document.name || registration.firstName !== document.name) {
		return 'The registration name changed after this email was queued.';
	}
	if (
		!isCancellationCommunication(document) &&
		(!document.qrCodeStoragePath ||
			registration.qrCodeStoragePath !== document.qrCodeStoragePath)
	) {
		return 'A newer confirmation-code image replaced this email.';
	}
	return undefined;
};

const updateRegistrationDeliveryStatusIfCurrent = async (
	context: LoadedEmailTriggerContext,
	updates: Record<string, unknown>,
	skipWhenAlreadySent = false,
): Promise<void> => {
	if (isCancellationCommunication(context.document)) {
		return;
	}

	await admin.firestore().runTransaction(async (transaction) => {
		const registrationSnapshot = await transaction.get(
			context.registrationDocRef,
		);
		const registration = registrationSnapshot.exists
			? (registrationSnapshot.data() as Registration)
			: undefined;
		if (
			(skipWhenAlreadySent && registration?.reminderEmailSentOn) ||
			getSupersededReason({ ...context, registration })
		) {
			return;
		}
		transaction.set(context.registrationDocRef, updates, { merge: true });
	});
};

const markQueueSuperseded = async (
	context: LoadedEmailTriggerContext,
	reason: string,
): Promise<void> => {
	await context.emailDocRef.set(buildSupersededUpdates(reason, new Date()), {
		merge: true,
	});
};

const buildSupersededUpdates = (reason: string, completedOn: Date) => ({
	deliveryState: queueProcessingState.superseded,
	deliveryCompletedOn: completedOn,
	failedOn: false,
	lastErrorMessage: false,
	lastErrorDetails: false,
	deliveryRequiresReviewOn: false,
	deliveryRequiresReviewReason: reason,
});

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
	// Simulated deliveries remain terminal even if real delivery is later restored.
	if (context.document.deliveryState === 'simulated') return true;
	const now = new Date();
	const supersededReason = getSupersededReason(context);
	if (supersededReason) {
		await markQueueSuperseded(context, supersededReason);
		return true;
	}

	if (
		!context.document.registrationUid &&
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
		await repairRegistrationStatus(context);
		return true;
	}

	if (context.document.deliveryState === queueProcessingState.sent) {
		await repairRegistrationStatus(context);
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
	const { document, registrationUid } = context;
	if (
		!document.code ||
		!document.name ||
		!document.email ||
		!document.formattedDateTime
	) {
		log.warn('Skipping incomplete queued registration email document', {
			uid: registrationUid,
			documentKeys: Object.keys(document).sort((left, right) =>
				left.localeCompare(right),
			),
		});
		return undefined;
	}
	if (!isCancellationCommunication(document) && !document.qrCodeStoragePath) {
		log.warn('Skipping registration email without a QR image snapshot', {
			uid: registrationUid,
		});
		return undefined;
	}

	return {
		uid: registrationUid,
		email: document.email,
		firstName: document.name,
		dateTime: document.formattedDateTime,
		code: document.code,
		...(document.qrCodeStoragePath
			? { qrCodeStoragePath: document.qrCodeStoragePath }
			: {}),
		templateKey: document.templateKey,
	};
};

const markQueueSending = async (
	context: LoadedEmailTriggerContext,
	attemptedOn: Date,
	triggerMetadata: EmailTriggerMetadata,
): Promise<boolean> => {
	const claimResult = await admin
		.firestore()
		.runTransaction(async (transaction) => {
			const [snapshot, registrationSnapshot] = await Promise.all([
				transaction.get(context.emailDocRef),
				transaction.get(context.registrationDocRef),
			]);
			const currentDocument = snapshot.data() as
				QueuedRegistrationEmailDocument | undefined;
			const currentRegistration = registrationSnapshot.exists
				? (registrationSnapshot.data() as Registration)
				: undefined;
			const supersededReason = currentDocument
				? getSupersededReason({
						...context,
						document: currentDocument,
						registration: currentRegistration,
					})
				: undefined;
			if (supersededReason) {
				transaction.set(
					context.emailDocRef,
					buildSupersededUpdates(supersededReason, attemptedOn),
					{ merge: true },
				);
				return { currentRegistration };
			}
			if (!shouldSendQueuedDocument(currentDocument)) {
				return { currentRegistration };
			}
			const claimed = {
				...currentDocument,
				deliveryState: queueProcessingState.sending,
				deliveryAttemptedOn: attemptedOn,
				deliveryAttemptEventId: triggerMetadata.eventId ?? false,
				deliveryAttemptCount:
					(currentDocument.deliveryAttemptCount ?? 0) + 1,
				deliveryProviderAcceptedOn: false,
				deliveryProviderMessageId: false,
				deliveryRequiresReviewOn: false,
				deliveryRequiresReviewReason: false,
			};
			transaction.set(context.emailDocRef, claimed, { merge: true });
			return { claimed, currentRegistration };
		});
	context.registration = claimResult.currentRegistration;
	if (!claimResult.claimed) {
		return false;
	}
	context.document = claimResult.claimed;
	return true;
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
			await updateRegistrationDeliveryStatusIfCurrent(context, {
				...successUpdates.registration,
				reminderEmailQueuedOn: queuedOn,
			});
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
		await updateRegistrationDeliveryStatusIfCurrent(
			context,
			failedUpdates.registration,
		);
	}
	throw error instanceof Error
		? error
		: new Error('Failed to send queued registration email');
};

export default async function sendRegistrationEmail(
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

	const simulated = isEmailSink();

	const attemptedOn = new Date();
	const queuedOn = getQueueRequestedOn(context.document, attemptedOn);

	if (!(await markQueueSending(context, attemptedOn, triggerMetadata))) {
		return;
	}

	const isCancellation = isCancellationCommunication(context.document);
	let templateName: string | undefined;
	let emailCommand: SendTemplatedEmailCommand | SendEmailCommand;
	let usePlainText = false;
	let deliveryMetadata: Record<string, unknown>;
	let renderedSinkContent: unknown;
	try {
		const profile = await admin
			.firestore()
			.doc(COLLECTION_SCHEMA.users + '/' + payload.uid)
			.get();
		const requestedLanguage = customerLanguageOrEnglish(
			profile.data()?.['preferredLanguage'],
		);
		let resolvedTemplate;
		try {
			resolvedTemplate = await resolvePublishedEmailTemplate({
				templateKey: isCancellation
					? 'registration-cancellation'
					: payload.templateKey,
				language: requestedLanguage,
			});
		} catch (error) {
			if (
				!isCancellation ||
				!(error instanceof Error) ||
				!error.message.includes(
					'does not have a published SES template',
				)
			)
				throw error;
		}
		const deliveredLanguage =
			resolvedTemplate?.language ?? requestedLanguage;
		const appointment = context.document.appointmentDateTime;
		payload.dateTime = appointment
			? formatRegistrationDateTime(appointment, deliveredLanguage)
			: payload.dateTime;
		if (
			isCancellation &&
			!appointment &&
			payload.dateTime === 'your previous appointment' &&
			deliveredLanguage === 'es'
		)
			payload.dateTime = 'tu cita anterior';
		deliveryMetadata = {
			requestedLanguage,
			deliveredLanguage,
			selectedTemplateKey:
				resolvedTemplate?.templateSummary.key ??
				'registration-cancellation',
			selectedRevisionId:
				resolvedTemplate?.templateSummary.publishedRevisionId ?? false,
			languageFallbackReason: resolvedTemplate?.fallbackReason ?? false,
		};
		if (!resolvedTemplate) {
			usePlainText = true;
			emailCommand = createCancellationEmailCommand(
				payload,
				deliveredLanguage,
			);
		} else {
			templateName = resolvedTemplate.templateName;
			const runtimeData = {
				firstName: payload.firstName,
				eventName: EVENT_DISPLAY_NAME,
				dateTime: payload.dateTime,
				...(!isCancellation
					? {
							code: payload.code,
							qrCodeUrl: await getRegistrationQrCodeUrl(
								payload.qrCodeStoragePath!,
							),
						}
					: {}),
			};
			emailCommand = createReminderEmailCommand(
				buildEmailTemplateDataFromMappings(
					resolvedTemplate.templateSummary.fieldMappings,
					runtimeData,
				),
				payload.email,
				templateName,
			);
			if (simulated) {
				const summary = resolvedTemplate.templateSummary;
				if (!summary.publishedRevisionId)
					throw new Error(
						'Published sink template revision is missing.',
					);
				const revision = await getEmailTemplateRevision(
					summary.key,
					summary.publishedRevisionId,
				);
				if (!revision)
					throw new Error(
						'Published sink template revision is missing.',
					);
				const html = await readEmailTemplateHtml(
					revision.htmlStoragePath,
				);
				const fields = revision.fieldMappings.map((field) => ({
					...field,
					sampleValue: String(
						runtimeData[
							(field.mapping.trim() ||
								field.name) as keyof typeof runtimeData
						] ?? '',
					),
				}));
				renderedSinkContent = {
					subject: renderTemplateWithFieldValues(
						revision.subjectPart,
						fields,
					),
					html: renderTemplateWithFieldValues(html, fields),
					text: renderTemplateWithFieldValues(
						revision.textPart ?? '',
						fields,
					),
				};
			}
		}
	} catch (error) {
		await persistFailedDelivery(
			context,
			getQueueRequestedOn(context.document, new Date()),
			undefined,
			error,
		);
		return;
	}

	let response: EmailDeliveryResponse | undefined;

	try {
		await context.emailDocRef.set(deliveryMetadata, { merge: true });
		if (simulated) {
			const receiptId = await recordSimulatedEmail(
				'registration',
				renderedSinkContent ?? emailCommand.input,
				triggeredSnapshot.id,
			);
			await context.emailDocRef.set(
				{
					deliveryState: 'simulated',
					deliveryTransport: 'test-sink',
					deliveryCompletedOn: new Date(),
					deliverySinkReceiptId: receiptId,
					failedOn: false,
					lastErrorMessage: false,
					lastErrorDetails: false,
				},
				{ merge: true },
			);
			return;
		}
		sesClient ??= new SESClient({
			credentials,
			region: SES_REGION,
		} as SESClientConfig);
		response = usePlainText
			? ((await sesClient.send(
					emailCommand as SendEmailCommand,
				)) as SendEmailCommandOutput)
			: ((await sesClient.send(
					emailCommand as SendTemplatedEmailCommand,
				)) as SendTemplatedEmailCommandOutput);
		// SES acceptance records the send request, not recipient delivery.
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
