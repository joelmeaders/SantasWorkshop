import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
	CheckIn,
	CheckInAggregatedStats,
	COLLECTION_SCHEMA,
	Registration,
} from '../models';
import {
	calculateRegistrationStats,
	isRegistrationComplete,
} from '../utility/registrations';
import admin from '../firebase-admin';
import { getErrorMessage, getErrorStatus } from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';
import { getStatsDocumentId, PROGRAM_YEAR } from '../utility/runtime-config';
import { isAdminToken } from '../utility/capabilities';
import { addCheckInToAggregatedStats } from '../utility/checkin-stats';

const log = createFunctionLogger('onSiteRegistration');

export default async function onSiteRegistration(
	request: CallableRequest<Registration>,
): Promise<number> {
	const record = request.data;

	if (!isAdminToken(request.auth?.token)) {
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

	// Check In
	const checkinDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.checkins}/${id}`);

	const checkin = {
		checkInDateTime: new Date(),
		customerId: record.uid,
		inStats: true,
		registrationCode: 'onsite',
		stats: calculateRegistrationStats(record, true),
	} as CheckIn;

	const statsDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.stats}/${getStatsDocumentId('checkin')}`);

	try {
		await admin.firestore().runTransaction(async (transaction) => {
			const statsDocument = await transaction.get(statsDocRef);
			transaction.create(registrationDocRef, updatedRegistration);
			transaction.create(checkinDocRef, checkin);
			transaction.set(
				statsDocRef,
				addCheckInToAggregatedStats(
					statsDocument.exists
						? (statsDocument.data() as CheckInAggregatedStats)
						: undefined,
					checkin,
				),
				{ merge: false },
			);
		});
		return checkin.stats!.children;
	} catch (error) {
		throw new HttpsError(
			getErrorStatus(error) ?? 'internal',
			getErrorMessage(error),
			error,
		);
	}
}
