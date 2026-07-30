import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import { isRegistrationComplete } from '../utility/registrations';
import {
	COLLECTION_SCHEMA,
	EMAIL_TEMPLATE_KEYS,
	Registration,
	RegistrationSearchIndex,
} from '../models';
import { formatRegistrationDateTime } from '../utility/date-time-format';
import { createFunctionLogger } from '../utility/observability';
import { serializeError } from '../utility/errors';
import { PROGRAM_YEAR } from '../utility/runtime-config';

const log = createFunctionLogger('completeRegistration');

export default async function completeRegistration(
	request: CallableRequest<Registration>,
): Promise<boolean | HttpsError> {
	const record = request.data;

	if (!isRegistrationComplete(record)) {
		log.warn('Attempted to complete an incomplete registration', {
			uid: record.uid ?? null,
		});
		throw new HttpsError(
			'failed-precondition',
			'-10',
			'Incomplete registration. Cannot continue.',
		);
	}

	if (record.uid !== request.auth?.uid) {
		log.warn('Unauthorized registration completion attempt', {
			actorUid: request.auth?.uid ?? null,
			targetUid: record.uid ?? null,
		});
		throw new HttpsError(
			'permission-denied',
			'-99',
			'You can only update your own records',
		);
	}

	if (record.registrationSubmittedOn) {
		log.warn('Attempted to complete an already-submitted registration', {
			uid: record.uid ?? null,
		});
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
		templateKey: EMAIL_TEMPLATE_KEYS.registrationConfirmation,
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
		log.error(
			'Failed to complete registration',
			{ uid: record.uid ?? null },
			error,
		);
		throw new HttpsError(
			'internal',
			'Failed to complete registration',
			serializeError(error),
		);
	}
}
