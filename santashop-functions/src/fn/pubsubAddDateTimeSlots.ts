import * as admin from 'firebase-admin';
import { COLLECTION_SCHEMA, DateTimeSlot } from '../../../santashop-models/src';

admin.initializeApp();

const dateTimeSlotCollection = admin
	.firestore()
	.collection(`${COLLECTION_SCHEMA.dateTimeSlots}`);

export default async (): Promise<void> => {
	const hasDateTimeSlots = !(await dateTimeSlotCollection.get()).empty;

	if (hasDateTimeSlots) {
		console.log('DateTimeSlots already exist. None added.');
		return Promise.resolve();
	}

	try {
		console.log('Adding DateTimeSlots...');
		await addDateTimeSlots();
		console.log('DateTimeSlots added.');
		return Promise.resolve();
	} catch (error: unknown) {
		throw new Error(`Error adding DateTimeSlots: ${error}`);
	}
};

const addDateTimeSlots = async () => {
	const collection = dateTimeSlotCollection;
	const programYear = 2023;

	const dateTimeSlots: DateTimeSlot[] = [
		{
			programYear: programYear,
			dateTime: new Date(`12-08-${programYear} 10:00 MST`),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-08-${programYear} 11:00 MST`),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-08-${programYear} 12:00 MST`),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-08-${programYear} 13:00 MST`),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-08-${programYear} 14:00 MST`),
			maxSlots: 300,
			enabled: true,
		},

		{
			programYear: programYear,
			dateTime: new Date(`12-09-${programYear} 10:00 MST`),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-09-${programYear} 11:00 MST`),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-09-${programYear} 12:00 MST`),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-09-${programYear} 13:00 MST`),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-09-${programYear} 14:00 MST`),
			maxSlots: 300,
			enabled: true,
		},

		{
			programYear: programYear,
			dateTime: new Date(`12-11-${programYear} 10:00 MST`),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-11-${programYear} 11:00 MST`),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-11-${programYear} 12:00 MST`),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-11-${programYear} 13:00 MST`),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-11-${programYear} 14:00 MST`),
			maxSlots: 250,
			enabled: true,
		},

		{
			programYear: programYear,
			dateTime: new Date(`12-12-${programYear} 10:00 MST`),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-12-${programYear} 11:00 MST`),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-12-${programYear} 12:00 MST`),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-12-${programYear} 13:00 MST`),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`12-12-${programYear} 14:00 MST`),
			maxSlots: 250,
			enabled: true,
		},
	];

	return Promise.all(
		dateTimeSlots.map(async (slot) => {
			await collection.add(slot);
		}),
	);
};
