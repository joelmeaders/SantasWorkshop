import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	loadTriggerScheduledHandlers,
	type TriggerScheduledAdminMock,
} from '../helpers/trigger-scheduled.unit-helper';

describe('scheduledFirestoreBackup handler', () => {
	let backgroundMock: TriggerScheduledAdminMock;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
		backgroundMock.batchCommit.mockResolvedValue(undefined);
		backgroundMock.exportDocuments.mockResolvedValue([{ name: 'op-123' }]);
	});

	it('starts a Firestore export with the configured backup bucket', async () => {
		const { scheduledFirestoreBackup } =
			await loadTriggerScheduledHandlers(backgroundMock);
		backgroundMock.databasePath.mockReturnValue(
			'projects/santas-workshop-test/databases/(default)',
		);
		process.env['GCLOUD_PROJECT'] = 'santas-workshop-test';

		await scheduledFirestoreBackup();

		expect(backgroundMock.exportDocuments).toHaveBeenCalledWith({
			name: 'projects/santas-workshop-test/databases/(default)',
			outputUriPrefix: 'gs://santashop-backups',
			collectionIds: [],
		});
	});
});
