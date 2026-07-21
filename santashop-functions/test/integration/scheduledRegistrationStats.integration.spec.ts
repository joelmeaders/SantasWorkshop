import { beforeEach, describe, expect, it } from 'vitest';
import scheduledRegistrationStats from '../../src/fn/scheduledRegistrationStats';
import { COLLECTION_SCHEMA } from '@santashop/models';
import {
	clearEmulatorData,
	createTimestamp,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('scheduledRegistrationStats integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('aggregates registration stats into the stats collection', async () => {
		await setDocument(COLLECTION_SCHEMA.registrations, 'reg-1', {
			uid: 'reg-1',
			programYear: 2025,
			zipCode: '80205',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			children: [{ toyType: 'girls', ageGroup: '3-5' }],
			dateTimeSlot: {
				dateTime: createTimestamp('2025-12-10T18:00:00.000Z'),
			},
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'reg-2', {
			uid: 'reg-2',
			programYear: 2025,
			zipCode: '80206',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			children: [{ toyType: 'boys', ageGroup: '6-8' }],
			dateTimeSlot: {
				dateTime: createTimestamp('2025-12-11T18:00:00.000Z'),
			},
		});

		await scheduledRegistrationStats();

		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.stats,
				'registration-2025',
			),
		).toMatchObject({ completedRegistrations: 2 });
	});
});
