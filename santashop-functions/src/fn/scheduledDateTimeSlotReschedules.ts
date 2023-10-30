/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v1/auth';
import { DateTimeSlot, Registration } from '../../../santashop-models/src';

admin.initializeApp();

/**
 * This method loads rescheduled registrations and updates
 * dateTimeSlots based on the values within.
 *
 * @returns
 */
export default async (): Promise<string> => {
	// Load all rescheduled registrations
	const registrations: Registration[] = await loadRegistrations();

	if (!registrations.length) return Promise.resolve('No registrations');

	// Load all date/time slots
	const dateTimeSlots: DateTimeSlot[] = await loadDateTimeSlots();

	if (!dateTimeSlots.length) return Promise.resolve('No date time slots');

	registrations.forEach((registration) => {
		const slotId = registration.previousDateTimeSlot?.id;
		const slot = dateTimeSlots.find((e) => e.id === slotId);

		if (slot !== undefined) {
			slot.slotsReserved = (slot.slotsReserved ?? 0) - 1;
			slot.enabled = slot.slotsReserved < slot.maxSlots;
			delete registration.previousDateTimeSlot;
		}
	});

	return admin
		.firestore()
		.runTransaction((transaction) => {
			dateTimeSlots.forEach((slot) => {
				const doc = admin
					.firestore()
					.collection('dateTimeSlots')
					.doc(slot.id!.toString());
				transaction.set(doc, slot);
			});

			registrations.forEach((registration) => {
				const doc = admin
					.firestore()
					.collection('registrations')
					.doc(registration.uid!.toString());
				transaction.set(doc, registration);
			});

			return Promise.resolve('Updated date time slots');
		})
		.catch((error) => {
			throw new HttpsError(
				'aborted',
				`transaction to update reschedules failed: ${JSON.stringify(
					error,
				)}`,
			);
		});
};

const dateTimeSlotQuery = (limit: number, offset: number) =>
	admin
		.firestore()
		.collection('dateTimeSlots')
		.where('programYear', '==', 2023)
		.limit(limit)
		.offset(offset);

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

const registrationQuery = (limit: number, offset: number) =>
	admin
		.firestore()
		.collection('registrations')
		.where('programYear', '==', 2023)
		.where('previousDateTimeSlot', '!=', '')
		.limit(limit)
		.offset(offset);

const loadRegistrations = async (): Promise<Registration[]> => {
	const pageSize = 50;
	let pageOffset = 0;
	let allRegistrations: Registration[] = [];

	do {
		const snapshotDocs = await registrationQuery(
			pageSize,
			pageOffset,
		).get();

		snapshotDocs.docs.forEach((doc) => {
			const slot = {
				...doc.data(),
			} as Registration;

			allRegistrations = allRegistrations.concat(slot);
		});

		pageOffset = snapshotDocs.docs.length - 1;
	} while (pageSize % pageOffset === 0 && pageOffset >= 0);

	return allRegistrations;
};
