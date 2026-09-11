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
		await setDocument(COLLECTION_SCHEMA.users, 'user-3', {
			referredBy: 'School Counselor',
		});
		await setDocument(COLLECTION_SCHEMA.users, 'user-4', {});

		await scheduledUserStats();

		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.stats,
				'user-2025',
			),
		).toMatchObject({
			totalUsers: 4,
			population: 'all-users',
			schemaVersion: 2,
			programYear: 2025,
			zipCodeCount: [
				{ zip: '80205', count: 2 },
				{ zip: 'Unknown', count: 2 },
			],
			referrerCount: [
				{ referrer: 'School Counselor', count: 2 },
				{ referrer: 'Unknown', count: 2 },
			],
		});
	});

	it('keeps observed profile history when current profiles are no longer present', async () => {
		await setDocument(COLLECTION_SCHEMA.stats, 'user-2025', {
			totalUsers: 3,
			zipCodeCount: [],
			referrerCount: [],
			dailySignups: [{ dateKey: '2025-11-01', count: 3 }],
		});
		await scheduledUserStats();
		await scheduledUserStats();
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.stats,
				'user-2025',
			),
		).toMatchObject({
			totalUsers: 0,
			signupCoverage: 'observed-profile-records',
			dailySignups: [{ dateKey: '2025-11-01', count: 3 }],
		});
	});
});
