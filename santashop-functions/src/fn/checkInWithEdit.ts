/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { CallableContext, HttpsError } from 'firebase-functions/v1/https';
import {
	CheckIn,
	COLLECTION_SCHEMA,
	Registration,
} from '../../../santashop-models/src/public-api';
import { calculateRegistrationStats } from '../utility/registrations';

admin.initializeApp();

export default async (
	record: Registration,
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

	if (!record?.children?.length || !record.uid) {
		console.error(
			new Error(
				`Registration incomplete. Unable to check in for uid ${record.uid}`
			)
		);
		throw new functions.https.HttpsError(
			'failed-precondition',
			'-12',
			'Incomplete registration. Cannot continue.'
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
		programYear: 2022,
	} as Partial<Registration>;

	batch.set(registrationDocRef, partialRegistration);

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

	batch.set(checkinDocRef, checkin);

	return batch
		.commit()
		.then(() => checkin)
		.catch((error: any) => {
			console.error(error);
			throw new Error(error);
		});
};
