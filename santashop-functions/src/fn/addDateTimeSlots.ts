import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { HttpsError } from 'firebase-functions/v1/https';
import { IDateTimeSlot } from '../../../santashop-models/src/lib/models/date-time-slot.model';
import { COLLECTION_SCHEMA } from '../../../santashop-models/src/lib/models/schema.model';


admin.initializeApp();

const dateTimeSlotCollection = admin
	.firestore()
	.collection(`${COLLECTION_SCHEMA.dateTimeSlots}`);

export default async (): Promise<void | HttpsError> => {
	try {
		if ((await dateTimeSlotCollection.get()).empty) {
			return addDateTimeSlots();
		}
	} catch (error) {
		console.error('Error creating date/time slot documents', error);
		throw new functions.https.HttpsError(
			'internal',
			'Something went terribly wrong...',
			JSON.stringify(error)
		);
	}
};

const addDateTimeSlots = async () => {
	const collection = dateTimeSlotCollection;
	const programYear = 2021;

	const demoValues: IDateTimeSlot[] = [
		{
			programYear: programYear,
			dateTime: new Date('12-09-2022 10:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-09-2022 11:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-09-2022 12:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-09-2022 13:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-09-2022 14:00 MST'),
			maxSlots: 300,
			enabled: true,
		},

		{
			programYear: programYear,
			dateTime: new Date('12-10-2022 10:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-10-2022 11:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-10-2022 12:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-10-2022 13:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-10-2022 14:00 MST'),
			maxSlots: 300,
			enabled: true,
		},

		{
			programYear: programYear,
			dateTime: new Date('12-12-2022 10:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-12-2022 11:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-12-2022 12:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-12-2022 13:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-12-2022 14:00 MST'),
			maxSlots: 250,
			enabled: true,
		},

		{
			programYear: programYear,
			dateTime: new Date('12-13-2022 10:00 MST'),
			maxSlots: 425000,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-13-2022 11:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-13-2022 12:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-13-2022 13:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-13-2022 14:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
	];

	demoValues.forEach(async (v) => {
		await collection.add(v);
	});

	return Promise.resolve();
};
