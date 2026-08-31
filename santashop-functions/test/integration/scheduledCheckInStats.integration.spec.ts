import { beforeEach, describe, expect, it } from 'vitest';
import scheduledCheckInStats from '../../src/fn/scheduledCheckInStats';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('scheduledCheckInStats integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('aggregates check-in stats and marks check-ins as inStats', async () => {
		await setDocument(COLLECTION_SCHEMA.checkins, 'checkin-1', {
			customerId: 'checkin-1',
			registrationCode: 'ABCD2345',
			checkInDateTime: createTimestamp('2025-12-10T18:15:00.000Z'),
			inStats: false,
			stats: {
				children: 2,
				modifiedAtCheckIn: false,
			},
		});

		const result = await scheduledCheckInStats();

		expect(result).toBe('Reset Checkins');
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.checkins,
				'checkin-1',
			),
		).toMatchObject({ inStats: true });
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.stats,
				'checkin-2025',
			),
		).toMatchObject({
			dateTimeCount: [{ customerCount: 1, childCount: 2 }],
		});
	});
});
