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

	it('preserves dated observations through repeated runs and later missing source records', async () => {
		const historical = {
			dateKey: '2025-11-15',
			calculatedAt: createTimestamp('2025-11-16T06:59:00Z'),
			coverage: 'current-records',
			registrationRecords: 4,
			submittedRegistrations: 3,
		};
		await setDocument(COLLECTION_SCHEMA.stats, 'registration-2025', {
			completedRegistrations: 3,
			dateTimeCount: [],
			zipCodeCount: [],
			dailySnapshots: [historical],
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'draft', {
			programYear: 2025,
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'cancelled', {
			programYear: 2025,
			cancelledOn: createTimestamp('2025-11-01T12:00:00Z'),
		});
		await setDocument(COLLECTION_SCHEMA.registrations, 'attended', {
			programYear: 2025,
			registrationSubmittedOn: createTimestamp('2025-11-01T12:00:00Z'),
			dateTimeSlot: { dateTime: createTimestamp('2025-12-10T19:00:00Z') },
		});
		await setDocument(
			COLLECTION_SCHEMA.registrations,
			'legacy-missing-year',
			{
				registrationSubmittedOn: createTimestamp(
					'2025-11-01T12:00:00Z',
				),
			},
		);
		await setDocument(COLLECTION_SCHEMA.checkins, 'attended', {
			registrationCode: 'preregistered',
			checkInDateTime: createTimestamp('2025-12-10T19:05:00Z'),
		});
		await setDocument(COLLECTION_SCHEMA.cancellations, 'cancellation', {
			programYear: 2025,
			cancelledOn: createTimestamp('2025-11-01T12:00:00Z'),
		});
		await scheduledRegistrationStats();
		await scheduledRegistrationStats();
		const report = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.stats,
			'registration-2025',
		);
		expect(report).toMatchObject({
			schemaVersion: 2,
			programYear: 2025,
			completedRegistrations: 1,
			operational: {
				registrationRecords: 3,
				submittedRegistrations: 1,
				draftRegistrations: 1,
				cancelledRegistrations: 1,
				recordedCancellationEvents: 1,
				checkedInRegistrations: 1,
				completionRate: 1 / 3,
			},
			dailySnapshots: expect.arrayContaining([
				expect.objectContaining({
					dateKey: '2025-11-15',
					submittedRegistrations: 3,
				}),
			]),
		});
		// Model a source population that is no longer assigned to this report's year.
		for (const id of ['draft', 'cancelled', 'attended']) {
			await setDocument(COLLECTION_SCHEMA.registrations, id, {
				programYear: 2026,
			});
		}
		await scheduledRegistrationStats();
		const afterReset = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.stats,
			'registration-2025',
		);
		expect(afterReset).toMatchObject({
			completedRegistrations: 0,
			dailySnapshots: expect.arrayContaining([
				expect.objectContaining({
					dateKey: '2025-11-15',
					submittedRegistrations: 3,
				}),
			]),
		});
	});
});
