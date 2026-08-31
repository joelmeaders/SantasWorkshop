import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	loadTriggerScheduledHandlers,
	type TriggerScheduledAdminMock,
} from '../helpers/trigger-scheduled.unit-helper';

describe('scheduledCheckInStats handler', () => {
	let backgroundMock: TriggerScheduledAdminMock;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
		backgroundMock.batchCommit.mockResolvedValue(undefined);
		backgroundMock.exportDocuments.mockResolvedValue([{ name: 'op-123' }]);
	});

	it('returns early when there are no check-ins to aggregate', async () => {
		const { scheduledCheckInStats } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('checkins', []);

		const result = await scheduledCheckInStats();

		expect(result).toBe('No checkins');
	});

	it('aggregates check-ins into local-time buckets and marks each record processed', async () => {
		const { scheduledCheckInStats } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('checkins', [
			{
				id: 'checkin-1',
				data: {
					registrationCode: 'ABCD1234',
					checkInDateTime: {
						toDate: () => new Date('2025-12-10T18:10:00.000Z'),
					},
					stats: { children: 2, modifiedAtCheckIn: true },
				},
			},
			{
				id: 'checkin-2',
				data: {
					registrationCode: 'onsite',
					checkInDateTime: {
						toDate: () => new Date('2025-12-10T18:45:00.000Z'),
					},
					stats: { children: 1, modifiedAtCheckIn: false },
				},
			},
		]);
		backgroundMock.setDocSnapshot('stats/checkin-2025', {
			lastUpdated: new Date('2025-12-01T00:00:00.000Z'),
			dateTimeCount: [],
		});

		await expect(scheduledCheckInStats()).resolves.toBe('Reset Checkins');

		expect(backgroundMock.transactionSet).toHaveBeenCalledTimes(2);
		expect(backgroundMock.getDocRef('stats/checkin-2025').set).toHaveBeenCalledWith(
			expect.objectContaining({
				dateTimeCount: [
					expect.objectContaining({
						customerCount: 2,
						childCount: 3,
						pregisteredCount: 1,
						modifiedCount: 1,
					}),
				],
			}),
			{ merge: false },
		);
	});
});
