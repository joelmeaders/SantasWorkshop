import { beforeEach, describe, expect, it } from 'vitest';
import pubsubResetCheckInStats from '../../src/fn/pubsubResetCheckInStats';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('pubsubResetCheckInStats integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('resets all check-ins to inStats false', async () => {
		await setDocument(COLLECTION_SCHEMA.checkins, 'checkin-1', {
			customerId: 'checkin-1',
			inStats: true,
		});

		const result = await pubsubResetCheckInStats();

		expect(result).toBe('Reset Checkins');
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.checkins,
				'checkin-1',
			),
		).toMatchObject({ inStats: false });
	});
});
