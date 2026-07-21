import { beforeEach, describe, expect, it } from 'vitest';
import scheduledUserStats from '../../src/fn/scheduledUserStats';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('scheduledUserStats integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('aggregates user stats into the stats collection', async () => {
		await setDocument(COLLECTION_SCHEMA.users, 'user-1', {
			zipCode: '80205',
			referredBy: 'School Counselor',
		});
		await setDocument(COLLECTION_SCHEMA.users, 'user-2', {
			zipCode: '80205',
		});

		await scheduledUserStats();

		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.stats,
				'user-2025',
			),
		).toMatchObject({ totalUsers: 1 });
	});
});
