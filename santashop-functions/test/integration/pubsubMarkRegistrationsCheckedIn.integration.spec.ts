import { beforeEach, describe, expect, it } from 'vitest';
import pubsubMarkRegistrationsCheckedIn from '../../src/fn/pubsubMarkRegistrationsCheckedIn';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('pubsubMarkRegistrationsCheckedIn integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('marks registrations as checked in from check-in records', async () => {
		await setDocument(COLLECTION_SCHEMA.checkins, 'checkin-1', {
			customerId: 'user-1',
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'user-1', {
			hasCheckedIn: false,
		});

		const result = await pubsubMarkRegistrationsCheckedIn();

		expect(result).toBe('Updated registrations');
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				'user-1',
			),
		).toMatchObject({ hasCheckedIn: true });
	});
});
