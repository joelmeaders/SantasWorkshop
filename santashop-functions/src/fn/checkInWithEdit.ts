import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
	CheckIn,
	CheckInAggregatedStats,
	CheckInRequest,
	COLLECTION_SCHEMA,
	Registration,
} from '../models';
import {
	calculateRegistrationStats,
	isPartialRegistrationComplete,
} from '../utility/registrations';
import admin from '../firebase-admin';
import { getErrorCode, getErrorMessage } from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';
import { getStatsDocumentId, PROGRAM_YEAR } from '../utility/runtime-config';
import { canCheckInToken } from '../utility/capabilities';
import { recordCheckInRaceAttempt } from '../utility/registration-scan';
import { addCheckInToAggregatedStats } from '../utility/checkin-stats';

const log = createFunctionLogger('checkInWithEdit');

export default async function checkInWithEdit(
	request: CallableRequest<CheckInRequest>,
): Promise<number> {
	const record = request.data?.registration ?? {};
	const inputMethod = request.data?.inputMethod;

	if (!canCheckInToken(request.auth?.token)) {
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
	if (inputMethod !== 'camera' && inputMethod !== 'manual') {
		throw new HttpsError(
			'invalid-argument',
			'Scan input method is invalid.',
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
		inStats: true,
		registrationCode: record.qrcode,
		stats: calculateRegistrationStats(record, true),
	} as CheckIn;

	const sourceRegistrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${record.uid}`);
	const statsDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.stats}/${getStatsDocumentId('checkin')}`);

	try {
		let authoritativeRegistration: Registration | undefined;
		const created = await admin
			.firestore()
			.runTransaction(async (transaction) => {
				const [sourceRegistration, existingCheckIn, statsDocument] =
					await Promise.all([
						transaction.get(sourceRegistrationDocRef),
						transaction.get(checkinDocRef),
						transaction.get(statsDocRef),
					]);
				if (!sourceRegistration.exists) {
					throw new HttpsError(
						'not-found',
						'Registration was not found.',
					);
				}
				authoritativeRegistration = {
					uid: sourceRegistration.id,
					...sourceRegistration.data(),
				} as Registration;
				if (
					authoritativeRegistration.qrcode !== record.qrcode ||
					!authoritativeRegistration.registrationSubmittedOn ||
					authoritativeRegistration.cancelledOn
				) {
					throw new HttpsError(
						'failed-precondition',
						'Registration is no longer eligible for check-in.',
					);
				}
				if (existingCheckIn.exists) return false;

				transaction.create(registrationDocRef, partialRegistration);
				transaction.create(checkinDocRef, checkin);
				transaction.set(
					sourceRegistrationDocRef,
					{ hasCheckedIn: true },
					{ merge: true },
				);
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
				return true;
			});
		if (!created && authoritativeRegistration && request.auth?.uid) {
			const blocked = await recordCheckInRaceAttempt(
				authoritativeRegistration,
				request.auth.uid,
				inputMethod,
			);
			throw new HttpsError(
				'already-exists',
				'Registration was already checked in.',
				blocked,
			);
		}
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
