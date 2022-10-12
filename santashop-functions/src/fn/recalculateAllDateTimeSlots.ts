/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as admin from 'firebase-admin';
import {
	IDateTimeSlot,
	IRegistration,
} from '../../../santashop-models/src/lib/models';

admin.initializeApp();

export default async (): Promise<string> => {
	// Load all registrations that need to be calculated
	const registrations: IRegistration[] = await loadRegistrations();

	if (!registrations.length) return Promise.resolve('No registrations');

	// Load all date/time slots
	const dateTimeSlots: IDateTimeSlot[] = await loadDateTimeSlots();

	if (!dateTimeSlots.length) return Promise.resolve('No date time slots');

	registrations.forEach((registration) => {
		const slotId = registration.dateTimeSlot?.id;
		const slot = dateTimeSlots.find((e) => e.id === slotId);

		if (slot !== undefined) {
			slot.slotsReserved = (slot.slotsReserved ?? 0) + 1;
			slot.enabled = slot.slotsReserved < slot.maxSlots;
			registration.includedInCounts = new Date();
		}
	});

	await admin.firestore().runTransaction((transaction) => {
		dateTimeSlots.forEach((slot) => {
			const doc = admin
				.firestore()
				.collection('dateTimeSlots')
				.doc(slot.id!.toString());
			transaction.update(doc, slot);
		});
		return Promise.resolve();
	});

	const batchSize = 499;
	let processed = 0;

	do {
		const batchRegs = registrations.splice(0, batchSize);

		await admin.firestore().runTransaction((transaction) => {
			batchRegs.forEach((registration) => {
				const doc = admin
					.firestore()
					.collection('registrations')
					.doc(registration.uid!.toString());
				transaction.update(doc, registration);
			});
			return Promise.resolve();
		});
		processed += batchRegs.length;
		console.info('Processed ', processed);
	} while (registrations.length > 0);

	return Promise.resolve('Updated date time slots');
};

const dateTimeSlotQuery = () =>
	admin
		.firestore()
		.collection('dateTimeSlots')
		.where('programYear', '==', 2021);

const loadDateTimeSlots = async (): Promise<IDateTimeSlot[]> => {
	let allDateTimeSlots: IDateTimeSlot[] = [];

	const snapshotDocs = await dateTimeSlotQuery().get();

	snapshotDocs.docs.forEach((doc) => {
		const slot = {
			id: doc.id,
			...doc.data(),
		} as IDateTimeSlot;

		slot.slotsReserved = 0;

		allDateTimeSlots = allDateTimeSlots.concat(slot);
	});

	return allDateTimeSlots;
};

const registrationQuery = () =>
	admin
		.firestore()
		.collection('registrations')
		.where('programYear', '==', 2021)
		.where('registrationSubmittedOn', '!=', '');

const loadRegistrations = async (): Promise<IRegistration[]> => {
	let allRegistrations: IRegistration[] = [];

	const snapshotDocs = await registrationQuery().get();

	snapshotDocs.docs.forEach((doc) => {
		const slot = {
			...doc.data(),
		} as IRegistration;

		allRegistrations = allRegistrations.concat(slot);
	});

	return allRegistrations;
};
