import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { CheckIn, COLLECTION_SCHEMA, Registration } from '../models';
import {
	calculateRegistrationStats,
	isPartialRegistrationComplete,
} from '../utility/registrations';
import admin from '../firebase-admin';
import { getErrorCode, getErrorMessage } from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';
import { isAdminToken } from '../utility/capabilities';

const log = createFunctionLogger('checkIn');

export default async function checkIn(
	request: CallableRequest<Partial<Registration>>,
): Promise<number> {
	const record = request.data;

	if (!isAdminToken(request.auth?.token)) {
		log.warn('Non-admin attempted to check in a registration', {
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
		log.warn('Attempted to check in an incomplete registration', {
			uid: record.uid ?? null,
		});
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

	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${record.uid}`);

	try {
		await admin.firestore().runTransaction(async (transaction) => {
			const registration = await transaction.get(registrationDocRef);
			if (!registration.exists) {
				throw new HttpsError(
					'not-found',
					'Registration was not found.',
				);
			}

			transaction.create(checkinDocRef, checkin);
			transaction.set(
				registrationDocRef,
				{ hasCheckedIn: true },
				{ merge: true },
			);
		});
		return checkin.stats?.children ?? 0;
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
