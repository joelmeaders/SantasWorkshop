import type { Timestamp } from 'firebase-admin/firestore';
import admin from '../firebase-admin';
import { createFunctionLogger } from '../utility/observability';
import { getStatsDocumentId, SHOP_TIME_ZONE } from '../utility/runtime-config';

let stats: ICheckInAggregatedStats;

const log = createFunctionLogger('scheduledCheckInStats');

export default async function scheduledCheckInStats(): Promise<string> {
	// Load all checkins
	const checkins: ICheckIn[] = await loadCheckIns();
	if (!checkins.length) return 'No checkins';

	// Get existing stats
	const statsDoc = await admin
		.firestore()
		.collection('stats')
		.doc(getStatsDocumentId('checkin'))
		.get();

	if (statsDoc.exists) {
		stats = statsDoc.data() as ICheckInAggregatedStats;
		stats.lastUpdated = new Date();
	} else {
		stats = {
			lastUpdated: new Date(),
			dateTimeCount: [],
		};
	}

	const batchSize = 499;
	let processed = 0;

	do {
		const batchRegs = checkins.splice(0, batchSize);

		await admin.firestore().runTransaction(async (transaction) => {
			batchRegs.forEach((record) => {
				const doc = admin
					.firestore()
					.collection('checkins')
					.doc(record.customerId!.toString());

				updateStats(record);

				transaction.set(doc, { inStats: true }, { merge: true });
			});
		});
		processed += batchRegs.length;
		log.info('Processed check-in stats batch', { processed });
	} while (checkins.length > 0);

	await admin
		.firestore()
		.collection('stats')
		.doc(getStatsDocumentId('checkin'))
		.set(stats, { merge: false });

	log.info('Updated check-in stats document', {
		processed: stats.dateTimeCount.reduce(
			(total, entry) => total + entry.customerCount,
			0,
		),
		bucketCount: stats.dateTimeCount.length,
	});

	stats = {} as ICheckInAggregatedStats;

	return 'Reset Checkins';
}

function updateStats(checkIn: ICheckIn): void {
	const localDate = checkIn.checkInDateTime
		.toDate()
		.toLocaleString('en-US', { timeZone: SHOP_TIME_ZONE });
	const checkInDate = new Date(localDate).getDate();
	const checkInHour = new Date(localDate).getHours();

	const index = stats.dateTimeCount.findIndex(
		(e) => e.date === checkInDate && e.hour === checkInHour,
	);

	if (index > -1) {
		stats.dateTimeCount[index].customerCount += 1;
		stats.dateTimeCount[index].childCount += checkIn.stats.children;
		if (checkIn.registrationCode !== 'onsite') {
			stats.dateTimeCount[index].pregisteredCount += 1;
		}
		if (checkIn.stats.modifiedAtCheckIn) {
			stats.dateTimeCount[index].modifiedCount += 1;
		}
		return;
	}

	const newItem: ICheckInDateTimeCount = {
		date: checkInDate,
		hour: checkInHour,
		customerCount: 1,
		childCount: checkIn.stats.children,
		pregisteredCount: checkIn.registrationCode !== 'onsite' ? 1 : 0,
		modifiedCount: checkIn.stats.modifiedAtCheckIn ? 1 : 0,
	};

	stats.dateTimeCount.push(newItem);
}

const loadCheckIns = async (): Promise<ICheckIn[]> => {
	let allRecords: ICheckIn[] = [];

	const snapshotDocs = await admin
		.firestore()
		.collection('checkins')
		.where('inStats', '==', false)
		.get();

	snapshotDocs.docs.forEach((doc) => {
		const record = {
			...doc.data(),
			customerId: doc.id,
		} as ICheckIn;

		allRecords = allRecords.concat(record);
	});

	return allRecords;
};

interface ICheckInAggregatedStats {
	lastUpdated: Date;
	dateTimeCount: ICheckInDateTimeCount[];
}

interface ICheckInDateTimeCount {
	date: number;
	hour: number;
	customerCount: number;
	pregisteredCount: number;
	modifiedCount: number;
	childCount: number;
}

interface ICheckIn {
	customerId?: string;
	registrationCode?: string;
	checkInDateTime: Timestamp;
	inStats: boolean;
	stats: ICheckInStats;
}

interface ICheckInStats {
	preregistered: boolean;
	children: number;
	ageGroup02: number;
	ageGroup35: number;
	ageGroup68: number;
	ageGroup911: number;
	toyTypeInfant: number;
	toyTypeBoy: number;
	toyTypeGirl: number;
	zipCode: string;
	modifiedAtCheckIn: boolean;
}
