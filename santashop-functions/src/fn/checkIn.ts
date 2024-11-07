/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { CallableContext } from 'firebase-functions/v1/https';
import {
	CheckIn,
	COLLECTION_SCHEMA,
	Registration,
} from '../../../santashop-models/src';
import {
	calculateRegistrationStats,
	isPartialRegistrationComplete,
} from '../utility/registrations';

admin.initializeApp();

export default (
	record: Partial<Registration>,
	context: CallableContext,
): Promise<number> => {
	if (!context.auth?.token?.admin) {
		console.error(
			`${context.auth?.uid} attempted to check in for uid ${record.uid} but is not an admin`,
		);
		throw new functions.https.HttpsError(
			'permission-denied',
			'-99',
			'You can only update your own records',
		);
	}

	if (!isPartialRegistrationComplete(record)) {
		console.error(
			`Registration incomplete. Unable to check in for uid ${record.uid}`,
		);
		throw new functions.https.HttpsError(
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
			throw new functions.https.HttpsError(
				error.code === 6 ? 'already-exists' : 'internal',
				error.message,
				error,
			);
		});
};
