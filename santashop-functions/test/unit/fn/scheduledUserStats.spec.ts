import { beforeEach, describe, expect, it } from 'vitest';
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
});
