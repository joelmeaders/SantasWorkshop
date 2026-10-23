import {
	createEmailSendClient,
	emailSendOptions,
} from '../utility/email-transport';
import {
	customerLanguageOrEnglish,
	EMAIL_TEMPLATE_KEYS,
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
	REGISTRATION_APP_URL,
	SES_REGION,
} from '../utility/runtime-config';
import {
	escapeEmailHtml,
	normalizeEmailAppLinks,
} from '../utility/email-links';
import { getRegistrationQrCodeUrl } from '../utility/qrcodes';
import {
	buildEmailTemplateDataFromMappings,
	getEmailTemplateRevision,
	readEmailTemplateHtml,
	renderTemplateWithFieldValues,
	resolvePublishedEmailTemplate,
} from '../utility/email-templates';
import {
	isEmailSink,
	recordSimulatedEmail,
} from '../../../scripts/load/functions/email-isolation';
import { isEmailSendingEnabled } from '../utility/email-sending';
import { getErrorCode, serializeError } from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';
import {
	normalizeDateTime,
	formatRegistrationDateTime,
	type DateTimeValue,
} from '../utility/date-time-format';

const log = createFunctionLogger('sendRegistrationEmail');
export const EMAIL_EVENT_MAX_AGE_MS = 30 * 60_000;
export const EMAIL_PREPARATION_MAX_ATTEMPTS = 3;
const PREPARATION_LEASE_MS = 150_000;

const credentials = {
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
let sesClient: SESClient | undefined = undefined;

interface EmailTriggerMetadata {
	eventTime?: string;
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
		| 'preparing'
		| 'queued'
		| 'sending'
		| 'accepted'
		| 'sent'
		| 'failed'
		| 'superseded'
		| 'simulated'
		| 'suppressed';
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

class QueueDocumentMissingError extends Error {}

const updateQueueDocument = async (
	context: LoadedEmailTriggerContext,
	updates: Record<string, unknown>,
): Promise<void> => {
	try {
		await context.emailDocRef.update(updates);
	} catch (error) {
		// Only a missing queue write cancels work. Other NOT_FOUND errors remain errors.
		if (
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			error.code === 5
		) {
			throw new QueueDocumentMissingError(
				'The queued email was deleted.',
			);
		}
		throw error;
	}
};

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

const deliveryField = (
	document: QueuedRegistrationEmailDocument,
	field: 'QueuedOn' | 'SentOn' | 'FailedOn',
): keyof Registration =>
	`${document.templateKey === EMAIL_TEMPLATE_KEYS.eventReminder ? 'eventReminder' : 'reminderEmail'}${field}` as keyof Registration;

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
		document.deliveryState === 'queued' ||
		(document.deliveryState === 'preparing' &&
			Date.now() -
				getNormalizedDate(
					document.deliveryAttemptedOn,
					new Date(),
				).getTime() >=
				PREPARATION_LEASE_MS)
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
							? `Hola ${payload.firstName},\n\nTu inscripción para ${EVENT_DISPLAY_NAME} fue cancelada. Tu cita anterior (${payload.dateTime}) ya no está reservada y tu boleto anterior ya no es válido.\n\nSi deseas asistir, inicia sesión y completa una nueva inscripción: ${REGISTRATION_APP_URL}`
							: `Hello ${payload.firstName},\n\nYour registration for ${EVENT_DISPLAY_NAME} has been cancelled. Your previous appointment (${payload.dateTime}) is no longer reserved, and the confirmation code from your cancelled registration is no longer valid.\n\nIf you would like to attend, sign in and submit a new registration: ${REGISTRATION_APP_URL}`,
				},
				Html: {
					Charset: 'UTF-8',
					Data: `<div style="font-family:Arial,sans-serif;line-height:1.6"><p>${language === 'es' ? 'Hola' : 'Hello'} ${escapeEmailHtml(payload.firstName)},</p><p>${language === 'es' ? `Tu inscripción para ${escapeEmailHtml(EVENT_DISPLAY_NAME)} fue cancelada. Tu cita anterior (${escapeEmailHtml(payload.dateTime)}) ya no está reservada y tu boleto anterior ya no es válido.` : `Your registration for ${escapeEmailHtml(EVENT_DISPLAY_NAME)} has been cancelled. Your previous appointment (${escapeEmailHtml(payload.dateTime)}) is no longer reserved, and your previous ticket is no longer valid.`}</p><p>${language === 'es' ? 'Si deseas asistir, inicia sesión y completa una nueva inscripción.' : 'If you would like to attend, sign in and submit a new registration.'}</p><p><a href="${escapeEmailHtml(REGISTRATION_APP_URL)}" style="display:inline-block;padding:16px 24px;background:#155344;color:#fff;font-weight:bold;text-decoration:none;border-radius:8px">${language === 'es' ? 'Inscribirme de nuevo' : 'Register again'}</a></p></div>`,
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
	if (!currentEmailDoc.exists) return undefined;
	const document = currentEmailDoc.data() as QueuedRegistrationEmailDocument;
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
					// Queues created before the field split still carry the exact
					// request time in the legacy field. The template proves intent.
					registration[deliveryField(document, 'QueuedOn')] ??
						(document.templateKey ===
						EMAIL_TEMPLATE_KEYS.eventReminder
							? registration.reminderEmailQueuedOn
							: undefined),
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
			(skipWhenAlreadySent &&
				registration?.[deliveryField(context.document, 'SentOn')]) ||
			getSupersededReason({ ...context, registration })
		) {
			return;
		}
		const status = { ...updates };
		for (const field of ['QueuedOn', 'SentOn', 'FailedOn'] as const) {
			const key = `reminderEmail${field}`;
			if (key in status) {
				const value = status[key];
				delete status[key];
				status[deliveryField(context.document, field)] = value;
			}
		}
		transaction.set(context.registrationDocRef, status, { merge: true });
	});
};

const markQueueSuperseded = async (
	context: LoadedEmailTriggerContext,
	reason: string,
): Promise<void> => {
	await updateQueueDocument(
		context,
		buildSupersededUpdates(reason, new Date()),
	);
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
	await updateQueueDocument(context, {
		deliveryRequiresReviewOn: reviewedOn,
		deliveryRequiresReviewReason: reason,
		lastErrorMessage: reason,
		lastErrorDetails: false,
	});
};

const syncSentQueueDocument = async (
	context: LoadedEmailTriggerContext,
	sentOn: Date,
): Promise<void> => {
	if (!context.currentEmailDoc.exists) {
		return;
	}

	try {
		await updateQueueDocument(context, {
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
		});
	} catch (error) {
		if (!(error instanceof QueueDocumentMissingError)) throw error;
	}
};

const canSkipDelivery = async (
	context: LoadedEmailTriggerContext,
	triggerMetadata: EmailTriggerMetadata,
): Promise<boolean> => {
	// Suppressed and simulated deliveries never replay when sending is restored.
	if (
		['simulated', 'suppressed'].includes(
			context.document.deliveryState ?? '',
		)
	)
		return true;
	const now = new Date();
	const supersededReason = getSupersededReason(context);
	if (supersededReason) {
		await markQueueSuperseded(context, supersededReason);
		return true;
	}

	if (
		!context.document.registrationUid &&
		!isCancellationCommunication(context.document) &&
		context.registration?.[deliveryField(context.document, 'SentOn')]
	) {
		await syncSentQueueDocument(
			context,
			getNormalizedDate(
				context.registration[
					deliveryField(context.document, 'SentOn')
				] as Date,
				now,
			),
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
		await persistDeliveryReviewRequirement(
			context,
			now,
			'Provider acceptance is unknown; automatic resend was skipped.',
		);
		return true;
	}

	if (
		context.document.deliveryState === 'preparing' &&
		!shouldSendQueuedDocument(context.document)
	) {
		throw new Error(
			'Email preparation is still reserved. Retry this event later.',
		);
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

const reserveEmailPreparation = async (
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
				transaction.update(
					context.emailDocRef,
					buildSupersededUpdates(supersededReason, attemptedOn),
				);
				return { currentRegistration };
			}
			if (!shouldSendQueuedDocument(currentDocument)) {
				return { currentRegistration };
			}
			if (
				(currentDocument.deliveryAttemptCount ?? 0) >=
				EMAIL_PREPARATION_MAX_ATTEMPTS
			) {
				transaction.update(context.emailDocRef, {
					deliveryState: 'failed',
					failedOn: attemptedOn,
					lastErrorMessage:
						'Email preparation attempt budget exhausted.',
				});
				return { currentRegistration };
			}
			const claimed = {
				...currentDocument,
				deliveryState: 'preparing' as const,
				deliveryAttemptedOn: attemptedOn,
				deliveryAttemptEventId: triggerMetadata.eventId ?? false,
				deliveryAttemptCount:
					(currentDocument.deliveryAttemptCount ?? 0) + 1,
				deliveryProviderAcceptedOn: false,
				deliveryProviderMessageId: false,
				deliveryRequiresReviewOn: false,
				deliveryRequiresReviewReason: false,
			};
			transaction.update(context.emailDocRef, claimed);
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
	await updateQueueDocument(context, {
		deliveryState: queueProcessingState.accepted,
		deliveryAttemptedOn: acceptedOn,
		deliveryProviderAcceptedOn: acceptedOn,
		deliveryProviderMessageId: response.MessageId ?? false,
		queuedOn,
		deliveryRequestedOn: queuedOn,
		failedOn: false,
		lastErrorMessage: false,
		lastErrorDetails: false,
	});
};

const persistSuccessfulDelivery = async (
	context: LoadedEmailTriggerContext,
	queuedOn: Date,
	sentOn: Date,
): Promise<void> => {
	const successUpdates = buildSuccessfulDeliveryUpdates(sentOn);
	let queueWriteError: unknown;
	try {
		await updateQueueDocument(context, {
			...successUpdates.queue,
			deliveryProviderAcceptedOn:
				context.document.deliveryProviderAcceptedOn ?? sentOn,
			deliveryProviderMessageId:
				context.document.deliveryProviderMessageId ?? false,
			queuedOn,
			deliveryRequestedOn: queuedOn,
		});
	} catch (error) {
		if (!(error instanceof QueueDocumentMissingError))
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
	if (error instanceof QueueDocumentMissingError) throw error;
	if (response) {
		throw error instanceof Error
			? error
			: new Error(
					'Failed to persist successful queued registration email delivery',
				);
	}

	const failedOn = new Date();
	const failedUpdates = buildFailedDeliveryUpdates(failedOn, error);
	try {
		await updateQueueDocument(context, {
			...failedUpdates.queue,
			queuedOn,
			deliveryRequestedOn: queuedOn,
		});
	} catch (queueError) {
		// Deleting the queue must not hide the original provider/template failure.
		throw queueError instanceof QueueDocumentMissingError
			? error
			: queueError;
	}
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

const updatePreparationClaim = async (
	context: LoadedEmailTriggerContext,
	updates: Record<string, unknown>,
): Promise<boolean> =>
	admin.firestore().runTransaction(async (transaction) => {
		const snapshot = await transaction.get(context.emailDocRef);
		if (!snapshot.exists)
			throw new QueueDocumentMissingError(
				'The queued email was deleted.',
			);
		const current = snapshot.data() as QueuedRegistrationEmailDocument;
		if (
			current.deliveryState !== 'preparing' ||
			current.deliveryAttemptCount !==
				context.document.deliveryAttemptCount
		)
			return false;
		if (updates['deliveryState'] === 'sending') {
			const registration = await transaction.get(
				context.registrationDocRef,
			);
			const reason = getSupersededReason({
				...context,
				document: current,
				registration: registration.data() as Registration | undefined,
			});
			if (reason) {
				transaction.update(
					context.emailDocRef,
					buildSupersededUpdates(reason, new Date()),
				);
				return false;
			}
		}
		transaction.update(context.emailDocRef, updates);
		return true;
	});

const recordPreparationFailure = async (
	context: LoadedEmailTriggerContext,
	error: unknown,
): Promise<void> => {
	if (error instanceof QueueDocumentMissingError) throw error;
	const code = getErrorCode(error);
	const transient = [
		4,
		8,
		10,
		14,
		'4',
		'8',
		'10',
		'14',
		'unavailable',
		'deadline-exceeded',
		'aborted',
		'resource-exhausted',
		'ECONNRESET',
		'ETIMEDOUT',
	].includes(code ?? '');
	const retry =
		transient &&
		(context.document.deliveryAttemptCount ?? 0) <
			EMAIL_PREPARATION_MAX_ATTEMPTS;
	const retained = await updatePreparationClaim(context, {
		deliveryState: retry ? 'queued' : 'failed',
		failedOn: retry ? false : new Date(),
		lastErrorMessage: retry
			? 'Temporary email preparation failure; retry pending.'
			: 'Email preparation failed or exhausted its attempt budget. Targeted recovery is required.',
		lastErrorDetails: false,
	});
	if (retained && retry) throw error;
};

const suppressDeliveryIfDisabled = async (
	context: LoadedEmailTriggerContext,
): Promise<boolean> => {
	if (await isEmailSendingEnabled()) return false;
	await updateQueueDocument(context, {
		deliveryState: 'suppressed',
		deliverySuppressionReason: 'email-sending-disabled',
		deliveryCompletedOn: new Date(),
		failedOn: false,
		lastErrorMessage: false,
		lastErrorDetails: false,
	});
	log.info('Queued email suppressed by the email sending control.');
	return true;
};

async function processRegistrationEmail(
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
	if (await suppressDeliveryIfDisabled(context)) return;

	const payload = resolveEmailPayload(context);
	if (!payload) {
		await updateQueueDocument(context, {
			deliveryState: 'failed',
			failedOn: new Date(),
			lastErrorMessage:
				'Incomplete email payload. Targeted recovery is required.',
		});
		return;
	}

	const simulated = isEmailSink();

	const attemptedOn = new Date();
	const queuedOn = getQueueRequestedOn(context.document, attemptedOn);

	if (
		!(await reserveEmailPreparation(context, attemptedOn, triggerMetadata))
	) {
		return;
	}

	const isCancellation = isCancellationCommunication(context.document);
	let templateName: string | undefined;
	let emailCommand: SendTemplatedEmailCommand | SendEmailCommand;
	let useFallbackEmail = false;
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
			useFallbackEmail = true;
			emailCommand = createCancellationEmailCommand(
				payload,
				deliveredLanguage,
			);
		} else {
			templateName = resolvedTemplate.templateName;
			const runtimeData = {
				registrationUrl: REGISTRATION_APP_URL,
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
					html: normalizeEmailAppLinks(
						renderTemplateWithFieldValues(html, fields),
					),
					text: normalizeEmailAppLinks(
						renderTemplateWithFieldValues(
							revision.textPart ?? '',
							fields,
						),
					),
				};
			}
		}
	} catch (error) {
		await recordPreparationFailure(context, error);
		return;
	}

	let response: EmailDeliveryResponse | undefined;
	let providerAttempted = false;

	try {
		// Rendering can outlive the cached permission. Check again at the send boundary.
		if (await suppressDeliveryIfDisabled(context)) return;
		if (simulated) {
			const receiptId = await recordSimulatedEmail(
				'registration',
				renderedSinkContent ?? emailCommand.input,
				triggeredSnapshot.id,
			);
			await updateQueueDocument(context, {
				...deliveryMetadata,
				deliveryState: 'simulated',
				deliveryTransport: 'test-sink',
				deliveryCompletedOn: new Date(),
				deliverySinkReceiptId: receiptId,
				failedOn: false,
				lastErrorMessage: false,
				lastErrorDetails: false,
			});
			return;
		}
		sesClient ??= createEmailSendClient({
			credentials,
			region: SES_REGION,
		} as SESClientConfig);
		if (
			!(await updatePreparationClaim(context, {
				...deliveryMetadata,
				deliveryState: 'sending',
				deliveryAttemptedOn: new Date(),
			}))
		)
			return;
		providerAttempted = true;
		response = useFallbackEmail
			? ((await sesClient.send(
					emailCommand as SendEmailCommand,
					emailSendOptions(),
				)) as SendEmailCommandOutput)
			: ((await sesClient.send(
					emailCommand as SendTemplatedEmailCommand,
					emailSendOptions(),
				)) as SendTemplatedEmailCommandOutput);
		// SES acceptance records the send request, not recipient delivery.
		const acceptedOn = new Date();
		context.document.deliveryState = queueProcessingState.accepted;
		context.document.deliveryProviderAcceptedOn = acceptedOn;
		context.document.deliveryProviderMessageId = response.MessageId;
		const sentOn = new Date();
		log.info('SES accepted queued registration email', {
			uid: payload.uid,
			templateName: templateName ?? 'registration-cancellation',
			templateKey: payload.templateKey ?? null,
			providerMessageId: response.MessageId ?? null,
			httpStatusCode: response.$metadata?.httpStatusCode,
		});
		try {
			await persistProviderAcceptance(
				context,
				queuedOn,
				acceptedOn,
				response,
			);
		} catch (error) {
			if (!(error instanceof QueueDocumentMissingError)) throw error;
		}
		await persistSuccessfulDelivery(context, queuedOn, sentOn);
	} catch (err) {
		if (err instanceof QueueDocumentMissingError) throw err;
		if (!providerAttempted) {
			await recordPreparationFailure(context, err);
			return;
		}
		log.error(
			'Failed to send queued registration email',
			{
				uid: payload.uid,
				templateName: templateName ?? 'registration-cancellation',
				templateKey: payload.templateKey ?? null,
			},
			err,
		);
		const status =
			typeof err === 'object' && err !== null && '$metadata' in err
				? (err as { $metadata?: { httpStatusCode?: number } }).$metadata
						?.httpStatusCode
				: undefined;
		const rejected = status !== undefined && status >= 400 && status < 500;
		if (providerAttempted && !response && !rejected) {
			try {
				await persistDeliveryReviewRequirement(
					context,
					new Date(),
					'Provider acceptance is unknown; automatic resend was skipped.',
				);
			} catch (reviewError) {
				if (!(reviewError instanceof QueueDocumentMissingError))
					throw reviewError;
				throw err;
			}
		}
		await persistFailedDelivery(context, queuedOn, response, err);
	}
}

export default async function sendRegistrationEmail(
	triggeredSnapshot: QueryDocumentSnapshot,
	triggerMetadata: EmailTriggerMetadata = {},
): Promise<void> {
	const eventTime =
		typeof triggerMetadata.eventTime === 'string'
			? Date.parse(triggerMetadata.eventTime)
			: NaN;
	const age = Date.now() - eventTime;
	if (
		typeof triggerMetadata.eventId !== 'string' ||
		triggerMetadata.eventId.length === 0 ||
		triggerMetadata.eventId.length > 512 ||
		!Number.isFinite(age) ||
		age < 0 ||
		age >= EMAIL_EVENT_MAX_AGE_MS
	) {
		log.warn(
			'Email event stopped before dependency reads; targeted review is required.',
			{
				queueDocumentId: triggeredSnapshot.id,
				eventId: triggerMetadata.eventId ?? null,
				reason: Number.isFinite(age)
					? 'event-age-budget'
					: 'invalid-event-metadata',
			},
		);
		return;
	}
	try {
		await processRegistrationEmail(triggeredSnapshot, triggerMetadata);
	} catch (error) {
		if (!(error instanceof QueueDocumentMissingError)) throw error;
		log.info('Stopped processing a deleted queued email', {
			queueDocumentId: triggeredSnapshot.id,
		});
	}
}
