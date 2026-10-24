import { createHash } from 'node:crypto';
import type { OnSiteRegistrationRequest } from '@santashop/models';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { CheckIn, CheckInAggregatedStats, COLLECTION_SCHEMA } from '../models';
import {
	calculateRegistrationStats,
	isRegistrationComplete,
} from '../utility/registrations';
import admin from '../firebase-admin';
import { getErrorMessage, getErrorStatus } from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';
import { getStatsDocumentId, PROGRAM_YEAR } from '../utility/runtime-config';
import { isAdminToken } from '../utility/capabilities';
import {
	requireZipCodeValue,
	withCallableValidation,
} from '../utility/callable-validation';
import { addCheckInToAggregatedStats } from '../utility/checkin-stats';
import {
	requireCanonicalChildren,
	requireMutationId,
} from './registrationMutationSupport';

const log = createFunctionLogger('onSiteRegistration');

export default async function onSiteRegistration(
	request: CallableRequest<OnSiteRegistrationRequest>,
): Promise<number> {
	const { mutationId: inputMutationId, ...record } = request.data;

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

	const mutationId = requireMutationId(inputMutationId);
	if (!request.auth?.uid)
		throw new HttpsError('unauthenticated', 'Sign in again.');
	const receiptRef = admin
		.firestore()
		.doc(`users/${request.auth.uid}/onSiteRegistrations/${mutationId}`);

	if (!isRegistrationComplete(record)) {
		log.warn('Attempted on-site registration with incomplete data', {
			uid: record.uid ?? null,
		});
		throw new HttpsError(
			'failed-precondition',

			'Incomplete registration. Cannot continue.',
		);
	}
	record.zipCode = withCallableValidation(() =>
		requireZipCodeValue(record.zipCode),
	);
	const children = requireCanonicalChildren(record.children);
	const canonicalRecord = { ...record, children };
	const fingerprint = createHash('sha256')
		.update(
			JSON.stringify(canonicalRecord, (_key, value: unknown): unknown =>
				value && typeof value === 'object' && !Array.isArray(value)
					? Object.fromEntries(
							Object.entries(value).sort(([a], [b]) =>
								a.localeCompare(b),
							),
						)
					: value,
			),
		)
		.digest('hex');

	const id = admin
		.firestore()
		.collection(COLLECTION_SCHEMA.onSiteRegistrations)
		.doc().id;

	// Registration
	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.onSiteRegistrations}/${id}`);

	const updatedRegistration = {
		...canonicalRecord,
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
		stats: calculateRegistrationStats(canonicalRecord, true),
	} as CheckIn;

	const statsDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.stats}/${getStatsDocumentId('checkin')}`);

	try {
		return await admin.firestore().runTransaction(async (transaction) => {
			const receipt = await transaction.get(receiptRef);
			if (receipt.exists) {
				const stored = receipt.data()!;
				if (stored['fingerprint'] !== fingerprint)
					throw new HttpsError(
						'already-exists',
						'This submission ID belongs to different family data.',
					);
				return stored['childCount'] as number;
			}
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
			transaction.create(receiptRef, {
				fingerprint,
				childCount: checkin.stats!.children,
				registrationId: id,
				completedOn: new Date(),
			});
			return checkin.stats!.children;
		});
	} catch (error) {
		if (error instanceof HttpsError) throw error;
		throw new HttpsError(
			getErrorStatus(error) ?? 'internal',
			getErrorMessage(error),
			error,
		);
	}
}
