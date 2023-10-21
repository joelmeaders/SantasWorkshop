/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { CallableContext } from 'firebase-functions/v1/https';
import {
	CheckIn,
	COLLECTION_SCHEMA,
	Registration,
} from '../../../santashop-models/src/public-api';
import {
	calculateRegistrationStats,
	isRegistrationComplete,
} from '../utility/registrations';

admin.initializeApp();

export default (
	record: Registration,
	context: CallableContext
): Promise<number> => {
	if (!context.auth?.token?.admin) {
		console.error(
			`${context.auth?.uid} attempted to check in for uid ${record.uid}`
		);
		throw new functions.https.HttpsError(
			'permission-denied',
			'-99',
			'You can only update your own records'
		);
	}

	if (!isRegistrationComplete(record)) {
		console.error(
			`Registration incomplete. Unable to check in for uid ${record.uid}`
		);
		throw new functions.https.HttpsError(
			'failed-precondition',

			'Incomplete registration. Cannot continue.'
		);
	}

	const id = admin
		.firestore()
		.collection(COLLECTION_SCHEMA.onSiteRegistrations)
		.doc().id;

	const batch = admin.firestore().batch();

	// Registration
	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.onSiteRegistrations}/${id}`);

	const updatedRegistration = {
		...record,
		uid: id,
		qrcode: 'onsite',
		registrationSubmittedOn: new Date(),
		includedInCounts: false,
		includedInRegistrationStats: false,
		programYear: 2023,
	};

	batch.create(registrationDocRef, updatedRegistration);

	// Check In
	const checkinDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.checkins}/${id}`);

	const checkin = {
		checkInDateTime: new Date(),
		customerId: record.uid,
		inStats: false,
		registrationCode: 'onsite',
		stats: calculateRegistrationStats(record, true),
	} as CheckIn;

	batch.create(checkinDocRef, checkin);

	return batch
		.commit()
		.then(() => checkin.stats!.children)
		.catch((error: any) => {
			throw new functions.https.HttpsError(
				error.status,
				error.message,
				error
			);
		});
};
