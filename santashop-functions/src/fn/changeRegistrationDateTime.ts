import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTION_SCHEMA, DateTimeSlot, Registration } from '../models';
import admin from '../firebase-admin';
import { formatRegistrationDateTime } from '../utility/date-time-format';
import {
	normalizeDateTime,
	type DateTimeValue,
} from '../utility/date-time-format';

const isAdminContext = (
	request: CallableRequest<ChangeRegistrationData>,
): boolean => {
	return request.auth?.token?.['admin'] === true;
};

interface ChangeRegistrationData {
	newDateTimeSlot: DateTimeSlot;
	registrationUid?: string;
}

interface RegistrationChangeEmailDocument {
	code?: string;
	email?: string;
	name?: string;
	formattedDateTime: string;
	queuedOn: Date;
	queueSource: 'date-time-change';
	deliveryRequestedOn: Date;
	deliveryState: 'queued';
	failedOn: false;
	lastErrorMessage: false;
	lastErrorDetails: false;
}

export default async function changeRegistrationDateTime(
	request: CallableRequest<ChangeRegistrationData>,
): Promise<boolean> {
	const data = request.data;
	// If registrationUid is provided (admin editing another user), use it; otherwise use authenticated user's uid
	const isAdmin = isAdminContext(request);
	const uid = data.registrationUid ?? request.auth?.uid;
	if (!uid) throw new HttpsError('unauthenticated', 'User not authenticated');

	if (!isAdmin && data.registrationUid) {
		throw new HttpsError(
			'permission-denied',
			"Only admins can change other users' registrations",
		);
	}

	if (!data.newDateTimeSlot) {
		throw new HttpsError(
			'invalid-argument',
			'New date/time slot is required',
		);
	}

	const batch = admin.firestore().batch();

	// Get current registration
	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);

	const registrationSnapshot = await registrationDocRef.get();
	if (!registrationSnapshot.exists) {
		throw new HttpsError(
			'not-found',
			`Registration not found for uid ${uid}`,
		);
	}

	const registrationDoc = { ...registrationSnapshot.data() } as Registration;

	// Verify registration is complete
	if (!registrationDoc.registrationSubmittedOn) {
		throw new HttpsError(
			'failed-precondition',
			'Registration not yet completed',
		);
	}

	// Prevent changes after check-in
	if (registrationDoc.hasCheckedIn) {
		throw new HttpsError(
			'failed-precondition',
			'Cannot change registration after check-in',
		);
	}

	// Store previous slot
	registrationDoc.previousDateTimeSlot = {
		...registrationDoc.dateTimeSlot,
	} as DateTimeSlot;

	// Update with new slot - store Date object directly (Firestore will auto-convert to Timestamp)
	// This matches the pattern in DateTimePageService.updateRegistration()
	const normalizedDateTime = normalizeDateTime(
		data.newDateTimeSlot.dateTime as DateTimeValue,
	);
	registrationDoc.dateTimeSlot = {
		id: data.newDateTimeSlot.id,
		dateTime: normalizedDateTime,
	};
	registrationDoc.includedInCounts = false;
	registrationDoc.reminderEmailSentOn = false;
	registrationDoc.reminderEmailFailedOn = false;

	batch.set(registrationDocRef, registrationDoc);

	// Create email record for new confirmation email
	const emailDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${uid}`);

	const queuedOn = new Date();
	const emailDoc: RegistrationChangeEmailDocument = {
		code: registrationDoc.qrcode,
		email: registrationDoc.emailAddress,
		name: registrationDoc.firstName,
		formattedDateTime: formatRegistrationDateTime(normalizedDateTime),
		queuedOn,
		queueSource: 'date-time-change',
		deliveryRequestedOn: queuedOn,
		deliveryState: 'queued',
		failedOn: false,
		lastErrorMessage: false,
		lastErrorDetails: false,
	};

	batch.set(emailDocRef, emailDoc, { merge: true });

	try {
		await batch.commit();
		return true;
	} catch (error) {
		console.error(`Error changing registration for uid ${uid}`, error);
		throw new HttpsError(
			'internal',
			'Error changing registration',
			JSON.stringify(error),
		);
	}
}
