import type { Timestamp } from 'firebase-admin/firestore';
import type { CheckIn, CheckInAggregatedStats } from '../models';
import admin from '../firebase-admin';
import { addCheckInToAggregatedStats } from '../utility/checkin-stats';
import { createFunctionLogger } from '../utility/observability';
import { getStatsDocumentId } from '../utility/runtime-config';

const log = createFunctionLogger('scheduledCheckInStats');

export default async function scheduledCheckInStats(): Promise<string> {
	const checkins = await loadCheckIns();
	if (!checkins.length) return 'No checkins';

	const statsDocRef = admin
		.firestore()
		.collection('stats')
		.doc(getStatsDocumentId('checkin'));
	const batchSize = 499;
	let processed = 0;

	do {
		const batchRecords = checkins.splice(0, batchSize);
		processed += await admin.firestore().runTransaction(async (transaction) => {
			const checkinDocRefs = batchRecords.map((record) =>
				admin.firestore().collection('checkins').doc(record.customerId),
			);
			const [statsDocument, ...checkinDocuments] = await Promise.all([
				transaction.get(statsDocRef),
				...checkinDocRefs.map((ref) => transaction.get(ref)),
			]);
			let nextStats = statsDocument.exists
				? (statsDocument.data() as CheckInAggregatedStats)
				: undefined;
			let batchProcessed = 0;

			checkinDocuments.forEach((document, index) => {
				if (!document.exists) return;
				const storedCheckIn = document.data() as StoredCheckIn;
				if (storedCheckIn.inStats !== false) return;

				nextStats = addCheckInToAggregatedStats(nextStats, {
					...storedCheckIn,
					checkInDateTime: storedCheckIn.checkInDateTime.toDate(),
				} as CheckIn);
				transaction.set(
					checkinDocRefs[index],
					{ inStats: true },
					{ merge: true },
				);
				batchProcessed += 1;
			});

			if (batchProcessed && nextStats) {
				transaction.set(statsDocRef, nextStats, { merge: false });
			}
			return batchProcessed;
		});
		log.info('Processed check-in stats batch', { processed });
	} while (checkins.length > 0);

	log.info('Updated check-in stats document', { processed });
	return 'Reset Checkins';
}

const loadCheckIns = async (): Promise<StoredCheckIn[]> => {
	const snapshot = await admin
		.firestore()
		.collection('checkins')
		.where('inStats', '==', false)
		.get();

	return snapshot.docs.map(
		(document) =>
			({
				...document.data(),
				customerId: document.id,
			}) as StoredCheckIn,
	);
};

interface StoredCheckIn {
	customerId: string;
	registrationCode?: string;
	checkInDateTime: Timestamp;
	inStats: boolean;
	stats: CheckIn['stats'];
}
