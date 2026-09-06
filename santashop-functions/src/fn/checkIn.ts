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
import { canCheckInToken } from '../utility/capabilities';
import {
	recordCheckInCreateConflictAttempt,
	recordCheckInRaceAttempt,
} from '../utility/registration-scan';
import { addCheckInToAggregatedStats } from '../utility/checkin-stats';
import { getStatsDocumentId } from '../utility/runtime-config';
import { requireCanonicalChildren } from './registrationMutationSupport';

const log = createFunctionLogger('checkIn');

export default async function checkIn(
	request: CallableRequest<CheckInRequest>,
): Promise<number> {
	const record = request.data?.registration ?? {};
	const inputMethod = request.data?.inputMethod;

	if (!canCheckInToken(request.auth?.token)) {
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
	if (inputMethod !== 'camera' && inputMethod !== 'manual') {
		throw new HttpsError(
			'invalid-argument',
			'Scan input method is invalid.',
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

	let childCount = 0;

	// Check In
	const checkinDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.checkins}/${record.uid}`);

	const registrationDocRef = admin
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
				const [registration, existingCheckIn, statsDocument] =
					await transaction.getAll(
						registrationDocRef,
						checkinDocRef,
						statsDocRef,
					);
				if (!registration.exists) {
					throw new HttpsError(
						'not-found',
						'Registration was not found.',
					);
				}
				authoritativeRegistration = {
					uid: registration.id,
					...registration.data(),
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
				const children = requireCanonicalChildren(
					authoritativeRegistration.children,
				);
				const canonicalRegistration = { ...authoritativeRegistration, children };
				const checkin = {
					checkInDateTime: new Date(),
					customerId: authoritativeRegistration.uid,
					inStats: true,
					registrationCode: authoritativeRegistration.qrcode,
					stats: calculateRegistrationStats(canonicalRegistration, false),
				} as CheckIn;
				childCount = checkin.stats?.children ?? 0;

				transaction.create(checkinDocRef, checkin);
				transaction.set(
					registrationDocRef,
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
		return childCount;
	} catch (error) {
		if (error instanceof HttpsError) {
			throw error;
		}
		const errorCode = getErrorCode(error);
		if (errorCode === '6' && record.uid && request.auth?.uid) {
			const blocked = await recordCheckInCreateConflictAttempt(
				record.uid,
				request.auth.uid,
				inputMethod,
			);
			if (blocked) {
				throw new HttpsError(
					'already-exists',
					'Registration was already checked in.',
					blocked,
				);
			}
		}
		throw new HttpsError(
			errorCode === '6' ? 'already-exists' : 'internal',
			getErrorMessage(error),
			error,
		);
	}
}
