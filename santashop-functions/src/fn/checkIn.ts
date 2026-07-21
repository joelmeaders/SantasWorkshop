import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { CheckIn, COLLECTION_SCHEMA, Registration } from '../models';
import {
	calculateRegistrationStats,
	isPartialRegistrationComplete,
} from '../utility/registrations';
import admin from '../firebase-admin';
import { getErrorCode, getErrorMessage } from '../utility/errors';

export default function checkIn(
	request: CallableRequest<Partial<Registration>>,
): Promise<number> {
	const record = request.data;

	if (!request.auth?.token?.admin) {
		console.error(
			`${request.auth?.uid} attempted to check in for uid ${record.uid} but is not an admin`,
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

	// Check In
	const checkinDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.checkins}/${record.uid}`);

	const checkin = {
		checkInDateTime: new Date(),
		customerId: record.uid,
		inStats: false,
		registrationCode: record.qrcode,
		stats: calculateRegistrationStats(record, false),
	} as CheckIn;

	return checkinDocRef
		.create(checkin)
		.then(() => checkin.stats?.children ?? 0)
		.catch((error) => {
			throw new HttpsError(
				getErrorCode(error) === '6' ? 'already-exists' : 'internal',
				getErrorMessage(error),
				error,
			);
		});
}
