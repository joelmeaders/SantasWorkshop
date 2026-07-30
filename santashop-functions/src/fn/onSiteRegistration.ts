import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { CheckIn, COLLECTION_SCHEMA, Registration } from '../models';
import {
	calculateRegistrationStats,
	isRegistrationComplete,
} from '../utility/registrations';
import admin from '../firebase-admin';
import { getErrorMessage, getErrorStatus } from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';
import { PROGRAM_YEAR } from '../utility/runtime-config';

const log = createFunctionLogger('onSiteRegistration');

export default async function onSiteRegistration(
	request: CallableRequest<Registration>,
): Promise<number> {
	const record = request.data;

	if (!request.auth?.token?.admin) {
		log.warn('Non-admin attempted an on-site registration', {
			actorUid: request.auth?.uid ?? null,
			targetUid: record.uid ?? null,
		});
		throw new HttpsError(
			'permission-denied',
			'-99',
			'You can only update your own records',
		);
	}

	if (!isRegistrationComplete(record)) {
		log.warn('Attempted on-site registration with incomplete data', {
			uid: record.uid ?? null,
		});
		throw new HttpsError(
			'failed-precondition',

			'Incomplete registration. Cannot continue.',
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
		programYear: PROGRAM_YEAR,
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

	try {
		await batch.commit();
		return checkin.stats!.children;
	} catch (error) {
		throw new HttpsError(
			getErrorStatus(error) ?? 'internal',
			getErrorMessage(error),
			error,
		);
	}
}
