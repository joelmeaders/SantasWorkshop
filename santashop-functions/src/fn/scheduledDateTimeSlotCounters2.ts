import admin from '../firebase-admin';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { DateTimeSlot, ScheduleStats } from '../models';
import { createFunctionLogger } from '../utility/observability';
import { getStatsDocumentId, PROGRAM_YEAR } from '../utility/runtime-config';

const log = createFunctionLogger('scheduledDateTimeSlotCounters2');
const COUNTER_CONCURRENCY = 10;

/**
 * This method loads all time slots and updates the reserved spots.
 * If the reserved spots is greater than the max slots, it disables the slot.
 */
export default async function scheduledDateTimeSlotCounters(): Promise<string> {
	// Load all date/time slots
	const dateTimeSlots: DateTimeSlot[] = await loadDateTimeSlots();
	if (!dateTimeSlots.length) return 'No date time slots';

	const scheduleStatsDoc = admin
		.firestore()
		.collection('stats')
		.doc(getStatsDocumentId('schedule'));
	const scheduleStats: ScheduleStats = { dateTimeCounts: [] };

	// Count in bounded parallel batches. This keeps the scheduled job quick
	// without creating an unbounded burst of Firestore aggregation queries.
	for (let index = 0; index < dateTimeSlots.length; index += COUNTER_CONCURRENCY) {
		const results = await Promise.all(
			dateTimeSlots
				.slice(index, index + COUNTER_CONCURRENCY)
				.map(reconcileDateTimeSlot),
		);
		scheduleStats.dateTimeCounts.push(...results);
	}

	// Update the schedule stats
	await scheduleStatsDoc.set({ ...scheduleStats }, { merge: true });
	log.info('Updated schedule stats from date time slot counters', {
		slotCount: dateTimeSlots.length,
	});

	return 'Updated date time slots';
}

const dateTimeSlotQuery = (
	limit: number,
	lastDocument?: QueryDocumentSnapshot,
) => {
	const query = admin
		.firestore()
		.collection('dateTimeSlots')
		.where('programYear', '==', PROGRAM_YEAR)
		.limit(limit);

	return lastDocument ? query.startAfter(lastDocument) : query;
};

const registrationsByDateTimeSlotQuery = (dateTimeSlotId: string) =>
	admin
		.firestore()
		.collection('registrations')
		.where('registrationSubmittedOn', '!=', '')
		.where('dateTimeSlot.id', '==', dateTimeSlotId)
		.count()
		.get();

const loadDateTimeSlots = async (): Promise<DateTimeSlot[]> => {
	const pageSize = 50;
	let currentPageSize = 0;
	let lastDocument: QueryDocumentSnapshot | undefined;
	let allDateTimeSlots: DateTimeSlot[] = [];

	do {
		const snapshotDocs = await dateTimeSlotQuery(pageSize, lastDocument).get();

		snapshotDocs.docs.forEach((doc) => {
			const slot = {
				id: doc.id,
				...doc.data(),
			} as DateTimeSlot;

			allDateTimeSlots = allDateTimeSlots.concat(slot);
		});

		currentPageSize = snapshotDocs.docs.length;
		lastDocument = snapshotDocs.docs.at(-1);
	} while (currentPageSize === pageSize);

	return allDateTimeSlots;
};

const reconcileDateTimeSlot = async (
	slot: DateTimeSlot,
): Promise<{ dateTime: Date; count: number }> => {
	const slotId = slot.id;
	if (!slotId) {
		return { dateTime: slot.dateTime, count: 0 };
	}

	const registrationCount = await registrationsByDateTimeSlotQuery(
		slotId,
	).then((snapshot) => snapshot.data().count);
	log.info('Evaluated date time slot reservation count', {
		slotId,
		registrationCount,
		previousSlotsReserved: slot.slotsReserved,
	});

	if (registrationCount !== slot.slotsReserved) {
		await admin
			.firestore()
			.collection('dateTimeSlots')
			.doc(slotId)
			.update({
				slotsReserved: registrationCount,
				enabled: registrationCount < slot.maxSlots,
				lastUpdated: new Date(),
			});
	}

	return { dateTime: slot.dateTime, count: registrationCount };
};
