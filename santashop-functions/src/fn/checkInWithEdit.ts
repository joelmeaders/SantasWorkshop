import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { CheckIn, COLLECTION_SCHEMA, Registration } from '../models';
import {
	calculateRegistrationStats,
	isPartialRegistrationComplete,
} from '../utility/registrations';
import admin from '../firebase-admin';
import { getErrorCode, getErrorMessage } from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';
import { PROGRAM_YEAR } from '../utility/runtime-config';
import { isAdminToken } from '../utility/capabilities';

const log = createFunctionLogger('checkInWithEdit');

export default async function checkInWithEdit(
	request: CallableRequest<Partial<Registration>>,
): Promise<number> {
	const record = request.data;

	if (!isAdminToken(request.auth?.token)) {
		log.warn('Non-admin attempted to check in with edits', {
			actorUid: request.auth?.uid ?? null,
			targetUid: record.uid ?? null,
		});
		throw new HttpsError(
			'permission-denied',
			'-99',
			'You can only update your own records',
		);
	}

	if (!isPartialRegistrationComplete(record)) {
		log.warn('Attempted to check in edited incomplete registration', {
			uid: record.uid ?? null,
		});
		throw new HttpsError(
			'failed-precondition',
			'-11',
			'Incomplete registration. Cannot continue.',
		);
	}

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

	const sourceRegistrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${record.uid}`);

	try {
		await admin.firestore().runTransaction(async (transaction) => {
			const sourceRegistration = await transaction.get(
				sourceRegistrationDocRef,
			);
			if (!sourceRegistration.exists) {
				throw new HttpsError(
					'not-found',
					'Registration was not found.',
				);
			}

			transaction.create(registrationDocRef, partialRegistration);
			transaction.create(checkinDocRef, checkin);
			transaction.set(
				sourceRegistrationDocRef,
				{ hasCheckedIn: true },
				{ merge: true },
			);
		});
		return checkin.stats!.children;
	} catch (error) {
		if (error instanceof HttpsError) {
			throw error;
		}
		throw new HttpsError(
			getErrorCode(error) === '6' ? 'already-exists' : 'internal',
			getErrorMessage(error),
			error,
		);
	}
}
