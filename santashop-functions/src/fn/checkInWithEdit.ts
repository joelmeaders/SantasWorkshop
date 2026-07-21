import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { CheckIn, COLLECTION_SCHEMA, Registration } from '../models';
import {
	calculateRegistrationStats,
	isPartialRegistrationComplete,
} from '../utility/registrations';
import admin from '../firebase-admin';
import { getErrorCode, getErrorMessage } from '../utility/errors';
import { PROGRAM_YEAR } from '../utility/runtime-config';

export default async function checkInWithEdit(
	request: CallableRequest<Partial<Registration>>,
): Promise<number> {
	const record = request.data;

	if (!request.auth?.token?.admin) {
		console.error(
			`${request.auth?.uid} attempted to check in for uid ${record.uid}`,
		);
		throw new HttpsError(
			'permission-denied',
			'-99',
			'You can only update your own records',
		);
	}

	if (!isPartialRegistrationComplete(record)) {
		console.error(
			`Registration incomplete. Unable to check in for uid ${record.uid}`,
		);
		throw new HttpsError(
			'failed-precondition',
			'-11',
			'Incomplete registration. Cannot continue.',
		);
	}

	const batch = admin.firestore().batch();

	// Registration
	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.editedRegistrations}/${record.uid}`);

	const partialRegistration = {
		uid: record.uid,
		children: record.children,
		registrationSubmittedOn: new Date(),
		includedInRegistrationStats: false,
		programYear: PROGRAM_YEAR,
	} as Partial<Registration>;

	batch.create(registrationDocRef, partialRegistration);

	// Check In
	const checkinDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.checkins}/${record.uid}`);

	const checkin = {
		checkInDateTime: new Date(),
		customerId: record.uid,
		inStats: false,
		registrationCode: record.qrcode,
		stats: calculateRegistrationStats(record, true),
	} as CheckIn;

	batch.create(checkinDocRef, checkin);

	try {
		await batch.commit();
		return checkin.stats!.children;
	} catch (error) {
		throw new HttpsError(
			getErrorCode(error) === '6' ? 'already-exists' : 'internal',
			getErrorMessage(error),
			error,
		);
	}
}
