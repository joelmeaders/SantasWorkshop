import admin from '../firebase-admin';
import { COLLECTION_SCHEMA, DateTimeSlot } from '../models';
import {
	createShopDate,
	DEFAULT_MAX_SLOTS,
	PROGRAM_YEAR,
	SHOP_DAYS,
} from '../utility/runtime-config';

const dateTimeSlotCollection = admin
	.firestore()
	.collection(`${COLLECTION_SCHEMA.dateTimeSlots}`);

export default async function pubsubAddDateTimeSlots(): Promise<void> {
	const hasDateTimeSlots = !(await dateTimeSlotCollection.get()).empty;

	if (hasDateTimeSlots) {
		console.log('DateTimeSlots already exist. None added.');
		return;
	}

	try {
		console.log('Adding DateTimeSlots...');
		await addDateTimeSlots();
		console.log('DateTimeSlots added.');
	} catch (error: unknown) {
		throw new Error(`Error adding DateTimeSlots: ${error}`);
	}
}

const createSlot = (day: string, hour: number): DateTimeSlot => {
	return {
		programYear: PROGRAM_YEAR,
		dateTime: createShopDate(day, hour),
		maxSlots: DEFAULT_MAX_SLOTS,
		enabled: true,
	};
};

const addDateTimeSlots = async (): Promise<void[]> => {
	const collection = dateTimeSlotCollection;
	const dateTimeSlots: DateTimeSlot[] = SHOP_DAYS.flatMap((shopDay) => {
		return [10, 11, 12, 13, 14].map((hour) => createSlot(shopDay, hour));
	});

	return Promise.all(
		dateTimeSlots.map(async (slot) => {
			await collection.add(slot);
		}),
	);
};
