import admin from '../firebase-admin';
import { COLLECTION_SCHEMA, DateTimeSlot } from '../models';
import { createFunctionLogger } from '../utility/observability';
import {
	createShopDate,
	DEFAULT_MAX_SLOTS,
	PROGRAM_YEAR,
	SHOP_DAYS,
} from '../utility/runtime-config';

const dateTimeSlotCollection = admin
	.firestore()
	.collection(`${COLLECTION_SCHEMA.dateTimeSlots}`);

const log = createFunctionLogger('pubsubAddDateTimeSlots');

export default async function pubsubAddDateTimeSlots(): Promise<void> {
	const hasDateTimeSlots = !(await dateTimeSlotCollection.get()).empty;

	if (hasDateTimeSlots) {
		log.info('Skipped date time slot creation because slots already exist');
		return;
	}

	try {
		log.info('Adding initial date time slots', {
			programYear: PROGRAM_YEAR,
			shopDayCount: SHOP_DAYS.length,
		});
		await addDateTimeSlots();
		log.info('Added initial date time slots', {
			programYear: PROGRAM_YEAR,
			slotCount: SHOP_DAYS.length * 5,
		});
	} catch (error: unknown) {
		log.error(
			'Failed to add initial date time slots',
			{ programYear: PROGRAM_YEAR },
			error,
		);
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
