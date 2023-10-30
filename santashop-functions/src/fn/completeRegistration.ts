/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { isRegistrationComplete } from '../utility/registrations';
import { CallableContext, HttpsError } from 'firebase-functions/v1/https';
import * as formatDateTime from 'dateformat';
import {
	COLLECTION_SCHEMA,
	Registration,
	RegistrationSearchIndex,
} from '../../../santashop-models/src';

admin.initializeApp();

export default async (
	record: Registration,
	context: CallableContext,
): Promise<boolean | HttpsError> => {
	if (!isRegistrationComplete(record)) {
		console.error(
			new Error(
				`Registration incomplete. Unable to submit registration for uid ${record.uid}`,
			),
		);
		throw new functions.https.HttpsError(
			'failed-precondition',
			'-10',
			'Incomplete registration. Cannot continue.',
		);
	}

	if (record.uid !== context.auth?.uid) {
		console.error(
			new Error(
				`${context.auth?.uid} attempted to update registration for uid ${record.uid}`,
			),
		);
		throw new functions.https.HttpsError(
			'permission-denied',
			'-99',
			'You can only update your own records',
		);
	}

	if (record.registrationSubmittedOn) {
		console.error(
			new Error(`Registration already submitted for uid ${record.uid}`),
		);
		throw new functions.https.HttpsError(
			'cancelled',
			'-98',
			'Already Submitted',
		);
	}

	const batch = admin.firestore().batch();

	// Registration
	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${record.uid}`);

	const updateRegistrationFields = {
		registrationSubmittedOn: new Date(),
		includedInCounts: false,
		includedInRegistrationStats: false,
		programYear: 2023,
	} as Partial<Registration>;

	batch.set(registrationDocRef, updateRegistrationFields, { merge: true });

	// Email Record
	const emailDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${record.uid}`);

	let dateTime: string;

	dateTime = record.dateTimeSlot?.dateTime as any as string;
	const tmp = new Date(dateTime);
	const dateZ = tmp.toLocaleString('en-US', { timeZone: 'MST' });
	dateTime = formatDateTime.default(dateZ, 'dddd, mmmm d, h:MM TT');

	const emailDoc = {
		code: record.qrcode,
		email: record.emailAddress,
		name: record.firstName,
		formattedDateTime: dateTime,
	};

	batch.set(emailDocRef, emailDoc, { merge: true });

	// Registration Search Index Record
	const indexDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrationSearchIndex}/${record.uid}`);

	const indexDoc: RegistrationSearchIndex = {
		code: record.qrcode,
		customerId: record.uid!,
		firstName: record.firstName!.toLowerCase(),
		lastName: record.lastName!.toLowerCase(),
		emailAddress: record.emailAddress!.toLowerCase(),
		zip: record.zipCode!,
	};

	batch.set(indexDocRef, indexDoc, { merge: true });

	return batch
		.commit()
		.then(() => true)
		.catch((error: any) => {
			console.error(error);
			throw new Error(error);
		});
};
