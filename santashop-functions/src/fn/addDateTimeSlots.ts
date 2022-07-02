import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { HttpsError } from 'firebase-functions/v1/https';
import {
	COLLECTION_SCHEMA,
	IDateTimeSlot,
} from '../../../santashop-models/src/lib/models';

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
			dateTime: new Date('12-10-2021 10:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-10-2021 11:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-10-2021 12:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-10-2021 13:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-10-2021 14:00 MST'),
			maxSlots: 300,
			enabled: true,
		},

		{
			programYear: programYear,
			dateTime: new Date('12-11-2021 10:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-11-2021 11:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-11-2021 12:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-11-2021 13:00 MST'),
			maxSlots: 300,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-11-2021 14:00 MST'),
			maxSlots: 300,
			enabled: true,
		},

		{
			programYear: programYear,
			dateTime: new Date('12-13-2021 10:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-13-2021 11:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-13-2021 12:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-13-2021 13:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-13-2021 14:00 MST'),
			maxSlots: 250,
			enabled: true,
		},

		{
			programYear: programYear,
			dateTime: new Date('12-14-2021 10:00 MST'),
			maxSlots: 425000,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-14-2021 11:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-14-2021 12:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-14-2021 13:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
		{
			programYear: programYear,
			dateTime: new Date('12-14-2021 14:00 MST'),
			maxSlots: 250,
			enabled: true,
		},
	];

	demoValues.forEach(async (v) => {
		await collection.add(v);
	});

	return Promise.resolve();
};
