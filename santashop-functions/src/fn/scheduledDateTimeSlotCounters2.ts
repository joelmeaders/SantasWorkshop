import admin from '../firebase-admin';
import { DateTimeSlot, ScheduleStats } from '../models';
import {
	getStatsDocumentId,
	PROGRAM_YEAR,
} from '../utility/runtime-config';

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

	// Loop through each date time slot and get the count of registrations
	for (const slot of dateTimeSlots) {
		// Get the count of registrations for this slot
		const slotId = slot.id;
		if (!slotId) {
			continue;
		}

		const registrationCount = await registrationsByDateTimeSlotQuery(
			slotId,
		).then((snapshot) => snapshot.data().count);

		// Update stats data
		scheduleStats.dateTimeCounts.push({
			dateTime: slot.dateTime,
			count: registrationCount,
		});
		console.log(`Slot ${slot.id} has ${slot.slotsReserved} registrations`);

		// No need to update if the count is the same
		if (registrationCount === slot.slotsReserved) continue;

		// Update the slot data
		slot.slotsReserved = registrationCount;
		slot.enabled = slot.slotsReserved < slot.maxSlots;

		// Update the slot in database
		const slotDoc = admin
			.firestore()
			.collection('dateTimeSlots')
			.doc(slotId.toString());
		await slotDoc.update({ ...slot });
	}

	// Update the schedule stats
	await scheduleStatsDoc.set({ ...scheduleStats }, { merge: true });

	return 'Updated date time slots';
}

const dateTimeSlotQuery = (limit: number, offset: number) =>
	admin
		.firestore()
		.collection('dateTimeSlots')
		.where('programYear', '==', PROGRAM_YEAR)
		.limit(limit)
		.offset(offset);

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
	let pageOffset = 0;
	let currentPageSize = 0;
	let allDateTimeSlots: DateTimeSlot[] = [];

	do {
		const snapshotDocs = await dateTimeSlotQuery(
			pageSize,
			pageOffset,
		).get();

		snapshotDocs.docs.forEach((doc) => {
			const slot = {
				id: doc.id,
				...doc.data(),
			} as DateTimeSlot;

			allDateTimeSlots = allDateTimeSlots.concat(slot);
		});

		currentPageSize = snapshotDocs.docs.length;
		pageOffset += snapshotDocs.docs.length;
	} while (currentPageSize === pageSize);

	return allDateTimeSlots;
};
