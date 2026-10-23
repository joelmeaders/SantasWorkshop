import { createHash } from 'node:crypto';
import type { ResendRegistrationEmailRequest } from '@santashop/models';
import { normalizeDateTime } from '../utility/date-time-format';
import { EMAIL_EVENT_MAX_AGE_MS } from './sendRegistrationEmail';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
	COLLECTION_SCHEMA,
	EMAIL_TEMPLATE_KEYS,
	Registration,
} from '../models';
import admin from '../firebase-admin';
import { formatRegistrationDateTime } from '../utility/date-time-format';
import { createFunctionLogger } from '../utility/observability';
import { isRegistrationComplete } from '../utility/registrations';
import { isAdminToken } from '../utility/capabilities';
import { requireAuthenticatedUid } from '../utility/callable-validation';

interface FirebaseAuthTokenLike {
	[key: string]: unknown;
}

interface ResendEmailDocument {
	registrationUid: string;
	code?: string;
	qrCodeStoragePath: string;
	email?: string;
	name?: string;
	appointmentDateTime: unknown;
	formattedDateTime: string;
	appointmentSlotId: string;
	templateKey: string;
	queuedOn: Date;
	queueSource: 'manual-resend';
	deliveryRequestedOn: Date;
	deliveryState: 'queued';
	recoveryOfQueueId?: string;
	failedOn: false;
	lastErrorMessage: false;
	lastErrorDetails: false;
}

const isAdminContext = (request: CallableRequest<unknown>): boolean => {
	const token = request.auth?.token as FirebaseAuthTokenLike | undefined;
	return isAdminToken(token);
};

const log = createFunctionLogger('callableResendRegistrationEmail');

export default async function callableResendRegistrationEmail(
	request: CallableRequest<ResendRegistrationEmailRequest>,
): Promise<boolean> {
	requireAuthenticatedUid(request);
	const data = request.data;
	const recoveryId = data.recoverQueueId;
	if (recoveryId !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(recoveryId))
		throw new HttpsError('invalid-argument', 'Email queue ID is invalid.');
	const db = admin.firestore();
	const queue = db.collection(COLLECTION_SCHEMA.tmpRegistrationEmails);
	const emailDocRef = recoveryId
		? queue.doc(
				`recovery_${createHash('sha256').update(recoveryId).digest('hex')}`,
			)
		: queue.doc();
	const originalRef = recoveryId ? queue.doc(recoveryId) : undefined;
	if (data.customerId) adminOrOwnerGuard(data.customerId, request);
	else if (!recoveryId || !isAdminContext(request))
		throw new HttpsError(
			'permission-denied',
			'Only staff can resolve a customer from an email queue ID.',
		);

	await db.runTransaction(async (transaction) => {
		const original = originalRef
			? await transaction.get(originalRef)
			: undefined;
		const customerId =
			data.customerId ??
			original?.data()?.['registrationUid'] ??
			original?.id;
		if (
			typeof customerId !== 'string' ||
			!customerId ||
			customerId.includes('/')
		)
			throw new HttpsError('not-found', 'Email job not found.');
		const registrationDocRef = db.doc(
			`${COLLECTION_SCHEMA.registrations}/${customerId}`,
		);
		const registrationSnapshot = await transaction.get(registrationDocRef);
		if (original && originalRef) {
			const recovered = await transaction.get(emailDocRef);
			const job = original.data();
			const registration = registrationSnapshot.data() as
				Registration | undefined;
			if (!job || (job['registrationUid'] ?? original.id) !== customerId)
				throw new HttpsError(
					'not-found',
					'Email job not found for this customer.',
				);
			if (recovered.exists || job['recoveryQueueId']) return;
			if (job['recoveryOfQueueId'])
				throw new HttpsError(
					'failed-precondition',
					'This email already used its recovery allowance. Contact support.',
				);
			if (
				job['deliveryProviderMessageId'] ||
				job['deliveryProviderAcceptedOn'] ||
				[
					'sent',
					'accepted',
					'simulated',
					'suppressed',
					'superseded',
				].includes(job['deliveryState'])
			)
				throw new HttpsError(
					'failed-precondition',
					'This email cannot be resent through recovery.',
				);
			const expired =
				Date.now() - original.createTime!.toMillis() >=
				EMAIL_EVENT_MAX_AGE_MS;
			if (job['deliveryState'] !== 'failed' && !expired)
				throw new HttpsError(
					'failed-precondition',
					'This email is still pending.',
				);
			if (
				(job['deliveryRequiresReviewOn'] ||
					job['deliveryState'] === 'sending') &&
				data.acknowledgeUncertainDelivery !== true
			)
				throw new HttpsError(
					'failed-precondition',
					'Delivery is uncertain. Review it and explicitly acknowledge the possible duplicate before recovery.',
				);

			const cancellation =
				job['queueSource'] === 'registration-cancellation';
			if (
				!registration ||
				job['code'] !== registration.qrcode ||
				job['email'] !== registration.emailAddress ||
				(cancellation
					? !registration.cancelledOn ||
						job['cancellationLogId'] !==
							registration.cancellationLogId
					: job['appointmentSlotId'] !==
							registration.dateTimeSlot?.id ||
						!registration.registrationSubmittedOn ||
						(job['appointmentDateTime'] &&
							(!registration.dateTimeSlot?.dateTime ||
								normalizeDateTime(
									job['appointmentDateTime'],
								).getTime() !==
									normalizeDateTime(
										registration.dateTimeSlot.dateTime,
									).getTime())))
			) {
				throw new HttpsError(
					'failed-precondition',
					'This email belongs to an older registration.',
				);
			}
			if (!cancellation) {
				const currentRequestedOn =
					job['templateKey'] === EMAIL_TEMPLATE_KEYS.eventReminder
						? (registration.eventReminderQueuedOn ??
							registration.reminderEmailQueuedOn)
						: registration.reminderEmailQueuedOn;
				const originalRequestedOn =
					job['deliveryRequestedOn'] ?? job['queuedOn'];
				if (
					!currentRequestedOn ||
					!originalRequestedOn ||
					normalizeDateTime(currentRequestedOn).getTime() !==
						normalizeDateTime(originalRequestedOn).getTime()
				)
					throw new HttpsError(
						'failed-precondition',
						'A newer email request replaced this email.',
					);
			}
			if (!cancellation) ensureQrReady(registration);
			const requestedOn = new Date();
			transaction.create(emailDocRef, {
				...job,
				recoveryOfQueueId: recoveryId,
				queuedOn: requestedOn,
				deliveryRequestedOn: requestedOn,
				deliveryState: 'queued',
				deliveryAttemptCount: 0,
				deliveryProviderAcceptedOn: false,
				deliveryProviderMessageId: false,
				deliveryRequiresReviewOn: false,
				deliveryRequiresReviewReason: false,
				failedOn: false,
				lastErrorMessage: false,
				lastErrorDetails: false,
			});
			transaction.update(originalRef, {
				recoveryQueueId: emailDocRef.id,
			});
			if (!cancellation) {
				const prefix =
					job['templateKey'] === EMAIL_TEMPLATE_KEYS.eventReminder
						? 'eventReminder'
						: 'reminderEmail';
				transaction.update(registrationDocRef, {
					[prefix + 'QueuedOn']: requestedOn,
					[prefix + 'FailedOn']: false,
					[prefix + 'SentOn']: false,
				});
			}
			return;
		}

		const record = registrationSnapshot.data() as Registration | undefined;
		if (!record) {
			throw new HttpsError('not-found', 'Registration not found');
		}
		registrationCompleteGuard(record);
		ensureQrReady(record);
		const dateTimeValue = record.dateTimeSlot?.['dateTime'];
		if (!dateTimeValue) {
			throw new HttpsError(
				'failed-precondition',
				'Missing registration date/time slot',
			);
		}
		const queuedOn = new Date();
		const emailDoc: ResendEmailDocument = {
			registrationUid: customerId,
			code: record.qrcode,
			qrCodeStoragePath: record.qrCodeStoragePath,
			email: record.emailAddress,
			name: record.firstName,
			appointmentDateTime: dateTimeValue,
			formattedDateTime: formatRegistrationDateTime(dateTimeValue),
			appointmentSlotId: record.dateTimeSlot?.id ?? '',
			templateKey: EMAIL_TEMPLATE_KEYS.registrationConfirmation,
			queuedOn,
			queueSource: 'manual-resend',
			deliveryRequestedOn: queuedOn,
			deliveryState: 'queued',
			failedOn: false,
			lastErrorMessage: false,
			lastErrorDetails: false,
		};
		transaction.create(emailDocRef, emailDoc);
		transaction.set(
			registrationDocRef,
			{
				reminderEmailQueuedOn: queuedOn,
				reminderEmailFailedOn: false,
				reminderEmailSentOn: false,
			},
			{ merge: true },
		);
	});

	return true;
}

function ensureQrReady(record: Registration): void {
	if (
		!record.qrCodeStoragePath ||
		!record.qrCodeGeneratedOn ||
		record.qrCodeGenerationFailedOn
	) {
		throw new HttpsError(
			'failed-precondition',
			'Registration QR code is not ready for email delivery',
		);
	}
}

function registrationCompleteGuard(record: Registration): void {
	if (!isRegistrationComplete(record)) {
		log.warn('Attempted to resend email for incomplete registration', {
			uid: record.uid ?? null,
		});
		throw new HttpsError(
			'failed-precondition',
			'-10',
			'Incomplete registration. Cannot continue.',
		);
	}
}

function adminOrOwnerGuard(
	registrationUid: string,
	request: CallableRequest<ResendRegistrationEmailRequest>,
): void {
	if (!isAdminContext(request) && registrationUid !== request.auth?.uid) {
		log.warn('Unauthorized registration email resend attempt', {
			actorUid: request.auth?.uid ?? null,
			targetUid: registrationUid,
		});
		throw new HttpsError(
			'permission-denied',
			'-99',
			'You can only update your own records',
		);
	}
}
