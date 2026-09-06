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
	request: CallableRequest<{ customerId: string }>,
): Promise<boolean> {
	const data = request.data;
	const db = admin.firestore();
	const emailDocRef = db
		.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
		.doc();
	const registrationDocRef = db.doc(
		`${COLLECTION_SCHEMA.registrations}/${data.customerId}`,
	);
	adminOrOwnerGuard(data.customerId, request);

	await db.runTransaction(async (transaction) => {
		const registrationSnapshot = await transaction.get(registrationDocRef);
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
			registrationUid: data.customerId,
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
	request: CallableRequest<{ customerId: string }>,
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
