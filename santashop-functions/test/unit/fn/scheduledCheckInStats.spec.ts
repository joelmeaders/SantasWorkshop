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
});
