import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { CallableContext } from 'firebase-functions/v1/https';
import { HttpsError } from 'firebase-functions/v1/auth';
import * as formatDateTime from 'dateformat';
import {
	COLLECTION_SCHEMA,
	DateTimeSlot,
	Registration,
} from '../../../santashop-models/src';

admin.initializeApp();

interface ChangeRegistrationData {
	newDateTimeSlot: DateTimeSlot;
	registrationUid?: string;
}

export default async function changeRegistrationDateTime(
	data: ChangeRegistrationData,
	context: CallableContext,
): Promise<boolean | HttpsError> {
	// If registrationUid is provided (admin editing another user), use it; otherwise use authenticated user's uid
	const isAdmin = context.auth?.token?.['admin'];
	const uid = data.registrationUid ?? context.auth?.uid;
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

	const registrationDoc = await registrationDocRef.get().then((snapshot) => {
		if (snapshot.exists) {
			return { ...snapshot.data() } as Registration;
		} else {
			throw new HttpsError(
				'not-found',
				`Registration not found for uid ${uid}`,
			);
		}
	});

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
	registrationDoc.dateTimeSlot = {
		id: data.newDateTimeSlot.id,
		dateTime: new Date(data.newDateTimeSlot.dateTime as unknown as string),
	};
	registrationDoc.includedInCounts = false;

	batch.set(registrationDocRef, registrationDoc);

	// Create email record for new confirmation email
	const emailDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${uid}`);

	let dateTime: string;
	dateTime = data.newDateTimeSlot.dateTime as unknown as string;
	const tmp = new Date(dateTime);
	const dateZ = tmp.toLocaleString('en-US', { timeZone: 'MST' });
	dateTime = formatDateTime.default(dateZ, 'dddd, mmmm d, h:MM TT');

	const emailDoc = {
		code: registrationDoc.qrcode,
		email: registrationDoc.emailAddress,
		name: registrationDoc.firstName,
		formattedDateTime: dateTime,
	};

	batch.set(emailDocRef, emailDoc, { merge: true });

	return batch
		.commit()
		.then(() => true)
		.catch((error: unknown) => {
			console.error(`Error changing registration for uid ${uid}`, error);
			throw new functions.https.HttpsError(
				'internal',
				'Error changing registration',
				JSON.stringify(error),
			);
		});
}
