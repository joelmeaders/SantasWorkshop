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
	const shopDays = ['12-13', '12-14', '12-16', '12-17'];
	const programYear = 2024;
	const defaultMaxSlots = 350;

	const dateTimeSlots: DateTimeSlot[] = [
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[0]}-${programYear} 10:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[0]}-${programYear} 11:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[0]}-${programYear} 12:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[0]}-${programYear} 13:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[0]}-${programYear} 14:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},

		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[1]}-${programYear} 10:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[1]}-${programYear} 11:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[1]}-${programYear} 12:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[1]}-${programYear} 13:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[1]}-${programYear} 14:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},

		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[2]}-${programYear} 10:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[2]}-${programYear} 11:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[2]}-${programYear} 12:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[2]}-${programYear} 13:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[2]}-${programYear} 14:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},

		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[3]}-${programYear} 10:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[3]}-${programYear} 11:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[3]}-${programYear} 12:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[3]}-${programYear} 13:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date(`${shopDays[3]}-${programYear} 14:00 MST`),
			maxSlots: defaultMaxSlots,
			enabled: true,
		},
	];

	return Promise.all(
		dateTimeSlots.map(async (slot) => {
			await collection.add(slot);
		}),
	);
};
