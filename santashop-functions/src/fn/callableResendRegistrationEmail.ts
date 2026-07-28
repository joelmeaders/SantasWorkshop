import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
	COLLECTION_SCHEMA,
	EMAIL_TEMPLATE_KEYS,
	Registration,
} from '../models';
import admin from '../firebase-admin';
import { formatRegistrationDateTime } from '../utility/date-time-format';
import { isRegistrationComplete } from '../utility/registrations';

interface FirebaseAuthTokenLike {
	[key: string]: unknown;
}

interface ResendEmailDocument {
	code?: string;
	email?: string;
	name?: string;
	formattedDateTime: string;
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
	return token?.['admin'] === true;
};

export default async function callableResendRegistrationEmail(
	request: CallableRequest<{ customerId: string }>,
): Promise<boolean> {
	const data = request.data;
	const recordRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${data.customerId}`);

	const record = (await recordRef.get()).data() as Registration | undefined;
	if (!record) {
		throw new HttpsError('not-found', 'Registration not found');
	}

	registrationCompleteGuard(record);
	adminOrOwnerGuard(record, request);
	ensureQrReady(record);

	const dateTimeValue = record.dateTimeSlot?.['dateTime'];
	if (!dateTimeValue) {
		throw new HttpsError(
			'failed-precondition',
			'Missing registration date/time slot',
		);
	}

	// Email Record Reference
	const emailDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${record.uid}`);
	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${record.uid}`);

	const queuedOn = new Date();
	const dateTime = formatRegistrationDateTime(dateTimeValue);

	const emailDoc: ResendEmailDocument = {
		code: record.qrcode,
		email: record.emailAddress,
		name: record.firstName,
		formattedDateTime: dateTime,
		templateKey: EMAIL_TEMPLATE_KEYS.registrationConfirmation,
		queuedOn,
		queueSource: 'manual-resend',
		deliveryRequestedOn: queuedOn,
		deliveryState: 'queued',
		failedOn: false,
		lastErrorMessage: false,
		lastErrorDetails: false,
	};

	await admin.firestore().runTransaction(async (transaction) => {
		transaction.set(emailDocRef, emailDoc, { merge: true });
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
	if (!record.qrCodeGeneratedOn || record.qrCodeGenerationFailedOn) {
		throw new HttpsError(
			'failed-precondition',
			'Registration QR code is not ready for email delivery',
		);
	}
}

function registrationCompleteGuard(record: Registration): void {
	if (!isRegistrationComplete(record)) {
		console.error(
			new Error(
				'Registration incomplete. Unable to send registration email.',
			),
		);
		throw new HttpsError(
			'failed-precondition',
			'-10',
			'Incomplete registration. Cannot continue.',
		);
	}
}

function adminOrOwnerGuard(
	record: Registration,
	request: CallableRequest<{ customerId: string }>,
): void {
	if (!isAdminContext(request) && record.uid !== request.auth?.uid) {
		console.error(
			new Error(
				`${request.auth?.uid} attempted to update registration for uid ${record.uid}`,
			),
		);
		throw new HttpsError(
			'permission-denied',
			'-99',
			'You can only update your own records',
		);
	}
}
