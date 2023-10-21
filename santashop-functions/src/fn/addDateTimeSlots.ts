import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { HttpsError } from 'firebase-functions/v1/https';
import {
	COLLECTION_SCHEMA,
	DateTimeSlot,
} from '../../../santashop-models/src/public-api';

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
	const programYear = 2023;

	const demoValues: DateTimeSlot[] = [
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

	demoValues.forEach(async (v) => {
		await collection.add(v);
	});

	return Promise.resolve();
};
