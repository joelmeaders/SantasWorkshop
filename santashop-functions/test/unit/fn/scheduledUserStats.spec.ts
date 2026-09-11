import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	loadTriggerScheduledHandlers,
	type TriggerScheduledAdminMock,
} from '../helpers/trigger-scheduled.unit-helper';

describe('scheduledUserStats handler', () => {
	let backgroundMock: TriggerScheduledAdminMock;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
		backgroundMock.batchCommit.mockResolvedValue(undefined);
		backgroundMock.exportDocuments.mockResolvedValue([{ name: 'op-123' }]);
	});

	afterEach(() => vi.useRealTimers());

	it('includes profile timestamps committed during the source read', async () => {
		const { scheduledUserStats } =
			await loadTriggerScheduledHandlers(backgroundMock);
		const beforeRead = new Date('2025-11-01T12:00:00Z');
		const createdDuringRead = new Date('2025-11-01T12:00:01Z');
		const afterRead = new Date('2025-11-01T12:00:02Z');
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(beforeRead);
		backgroundMock
			.getCollectionRef('users')
			.get.mockImplementation(async () => {
				await Promise.resolve();
				vi.setSystemTime(afterRead);
				return {
					docs: [
						{
							id: 'created-during-read',
							data: () => ({}),
							createTime: { toDate: () => createdDuringRead },
						},
					],
				};
			});
		await scheduledUserStats();
		expect(
			backgroundMock.getDocRef('stats/user-2025').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				calculatedAt: afterRead,
				totalUsers: 1,
				signupDatesUnavailable: 0,
				dailySignups: [{ dateKey: '2025-11-01', count: 1 }],
			}),
			{ merge: false },
		);
	});

	it('aggregates user stats and writes them to the stats collection', async () => {
		const { scheduledUserStats } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('users', [
			{
				id: 'user-1',
				data: {
					zipCode: '80205',
					referredBy: 'School Counselor',
				},
			},
		]);
		backgroundMock
			.getDocRef('stats/user-2025')
			.set.mockResolvedValue(undefined);

		await scheduledUserStats();

		expect(
			backgroundMock.getDocRef('stats/user-2025').set,
		).toHaveBeenCalledTimes(1);
	});

	it('includes all profiles and counts each missing demographic independently', async () => {
		const { scheduledUserStats } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('users', [
			{
				id: 'complete',
				data: { zipCode: '80205-1111', referredBy: 'School' },
			},
			{ id: 'no-referrer', data: { zipCode: '80205' } },
			{ id: 'no-zip', data: { referredBy: 'School' } },
			{ id: 'empty', data: { zipCode: ' ', referredBy: ' ' } },
		]);
		await scheduledUserStats();
		expect(
			backgroundMock.getDocRef('stats/user-2025').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				totalUsers: 4,
				population: 'all-users',
				schemaVersion: 2,
				programYear: 2025,
				calculatedAt: expect.any(Date),
				signupDatesUnavailable: 4,
				zipCodeCount: [
					{ zip: '80205', count: 2 },
					{ zip: 'Unknown', count: 2 },
				],
				referrerCount: [
					{ referrer: 'School', count: 2 },
					{ referrer: 'Unknown', count: 2 },
				],
			}),
			{ merge: false },
		);
	});

	it('groups stored profile creation dates locally and retains earlier observations after deletion', async () => {
		const { scheduledUserStats } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.getCollectionRef('users').get.mockResolvedValue({
			docs: [
				{
					id: 'one',
					data: () => ({}),
					createTime: {
						toDate: () => new Date('2025-11-02T01:00:00Z'),
					},
				},
				{
					id: 'two',
					data: () => ({}),
					createTime: {
						toDate: () => new Date('2025-11-02T02:00:00Z'),
					},
				},
				{
					id: 'older',
					data: () => ({}),
					createTime: {
						toDate: () => new Date('2024-11-01T12:00:00Z'),
					},
				},
				{ id: 'missing', data: () => ({}) },
			],
		});
		backgroundMock.setDocSnapshot('stats/user-2025', {
			dailySignups: [{ dateKey: '2025-10-31', count: 7 }],
		});
		await scheduledUserStats();
		expect(
			backgroundMock.getDocRef('stats/user-2025').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				dailySignups: [
					{ dateKey: '2025-10-31', count: 7 },
					{ dateKey: '2025-11-01', count: 2 },
				],
				signupDatesOutsideProgramYear: 1,
				signupDatesUnavailable: 1,
			}),
			{ merge: false },
		);
	});
});
