import { beforeEach, describe, expect, it } from 'vitest';
import scheduledDateTimeSlotCounters from '../../src/fn/scheduledDateTimeSlotCounters2';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('scheduledDateTimeSlotCounters2 integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('updates slot counters and schedule stats from submitted registrations', async () => {
		await setDocument(COLLECTION_SCHEMA.dateTimeSlots, 'slot-1', {
			programYear: 2025,
			dateTime: createTimestamp('2025-12-10T18:00:00.000Z'),
			maxSlots: 10,
			slotsReserved: 0,
			enabled: true,
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'reg-1', {
			uid: 'reg-1',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			dateTimeSlot: { id: 'slot-1' },
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'reg-2', {
			uid: 'reg-2',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			dateTimeSlot: { id: 'slot-1' },
		});

		const result = await scheduledDateTimeSlotCounters();

		expect(result).toBe('Updated date time slots');
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.dateTimeSlots,
				'slot-1',
			),
		).toMatchObject({ slotsReserved: 2, enabled: true });
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.stats,
				'schedule-2025',
			),
		).toMatchObject({ dateTimeCounts: [{ count: 2 }] });
	});
});
