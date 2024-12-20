/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as admin from 'firebase-admin';
import { DateTimeSlot, ScheduleStats } from '../../../santashop-models/src';

admin.initializeApp();

/**
 * This method loads all time slots and updates the reserved spots.
 * If the reserved spots is greater than the max slots, it disables the slot.
 */
export default async (): Promise<string> => {
	// Load all date/time slots
	const dateTimeSlots: DateTimeSlot[] = await loadDateTimeSlots();
	if (!dateTimeSlots.length) return Promise.resolve('No date time slots');

	const scheduleStatsDoc = admin
		.firestore()
		.collection('stats')
		.doc('schedule-2024');
	const scheduleStats: ScheduleStats = { dateTimeCounts: [] };

	// Loop through each date time slot and get the count of registrations
	for (const slot of dateTimeSlots) {
		// Get the count of registrations for this slot
		const registrationCount = await registrationsByDateTimeSlotQuery(
			slot.id!,
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
			.doc(slot.id!.toString());
		await slotDoc.update({ ...slot });
	}

	// Update the schedule stats
	await scheduleStatsDoc.set({ ...scheduleStats }, { merge: true });

	return Promise.resolve('Updated date time slots');
};

const dateTimeSlotQuery = (limit: number, offset: number) =>
	admin
		.firestore()
		.collection('dateTimeSlots')
		.where('programYear', '==', 2024)
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

		pageOffset = snapshotDocs.docs.length - 1;
	} while (pageSize % pageOffset === 0 && pageOffset >= 0);

	return allDateTimeSlots;
};
