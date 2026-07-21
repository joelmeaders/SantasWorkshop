import { beforeEach, describe, expect, it } from 'vitest';
import pubsubAddDateTimeSlots from '../../src/fn/pubsubAddDateTimeSlots';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	getCollectionCount,
} from '../helpers/admin-emulator';

describe.sequential('pubsubAddDateTimeSlots integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('adds the default date time slots when none exist', async () => {
		await pubsubAddDateTimeSlots();

		expect(await getCollectionCount(COLLECTION_SCHEMA.dateTimeSlots)).toBe(
			20,
		);
	});
});
