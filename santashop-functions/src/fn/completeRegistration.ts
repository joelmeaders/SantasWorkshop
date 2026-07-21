import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import { isRegistrationComplete } from '../utility/registrations';
import {
	COLLECTION_SCHEMA,
	Registration,
	RegistrationSearchIndex,
} from '../models';
import { formatRegistrationDateTime } from '../utility/date-time-format';
import { serializeError } from '../utility/errors';
import { PROGRAM_YEAR } from '../utility/runtime-config';

export default async function completeRegistration(
	request: CallableRequest<Registration>,
): Promise<boolean | HttpsError> {
	const record = request.data;

	if (!isRegistrationComplete(record)) {
		console.error(
			new Error(
				`Registration incomplete. Unable to submit registration for uid ${record.uid}`,
			),
		);
		throw new HttpsError(
			'failed-precondition',
			'-10',
			'Incomplete registration. Cannot continue.',
		);
	}

	if (record.uid !== request.auth?.uid) {
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

	if (record.registrationSubmittedOn) {
		console.error(
			new Error(`Registration already submitted for uid ${record.uid}`),
		);
		throw new HttpsError('cancelled', '-98', 'Already Submitted');
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
		programYear: PROGRAM_YEAR,
	} as Partial<Registration>;

	batch.set(registrationDocRef, updateRegistrationFields, { merge: true });

	// Email Record
	const emailDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${record.uid}`);

	const emailDoc = {
		code: record.qrcode,
		email: record.emailAddress,
		name: record.firstName,
		formattedDateTime: formatRegistrationDateTime(
			record.dateTimeSlot?.dateTime as string,
		),
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

	try {
		await batch.commit();
		return true;
	} catch (error) {
		console.error(error);
		throw new HttpsError(
			'internal',
			'Failed to complete registration',
			serializeError(error),
		);
	}
}
