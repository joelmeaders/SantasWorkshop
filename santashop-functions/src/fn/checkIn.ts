/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { CallableContext, HttpsError } from 'firebase-functions/v1/https';
import {
	CheckIn,
	COLLECTION_SCHEMA,
	Registration,
} from '../../../santashop-models/src/public-api';
import {
	calculateRegistrationStats,
	isPartialRegistrationComplete,
} from '../utility/registrations';

admin.initializeApp();

export default async (
	record: Partial<Registration>,
	context: CallableContext
): Promise<CheckIn | HttpsError> => {
	if (!context.auth?.token.claims?.admin) {
		console.error(
			new Error(
				`${context.auth?.uid} attempted to check in for uid ${record.uid}`
			)
		);
		throw new functions.https.HttpsError(
			'permission-denied',
			'-99',
			'You can only update your own records'
		);
	}

	if (!isPartialRegistrationComplete(record)) {
		console.error(
			new Error(
				`Registration incomplete. Unable to check in for uid ${record.uid}`
			)
		);
		throw new functions.https.HttpsError(
			'failed-precondition',
			'-11',
			'Incomplete registration. Cannot continue.'
		);
	}

	const batch = admin.firestore().batch();

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

	batch.set(checkinDocRef, checkin);

	return batch
		.commit()
		.then(() => checkin)
		.catch((error: any) => {
			console.error(error);
			throw new Error(error);
		});
};
