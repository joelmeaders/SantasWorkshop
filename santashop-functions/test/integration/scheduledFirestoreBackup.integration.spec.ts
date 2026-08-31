import { describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../helpers/firebase-admin-background.mock';

describe('scheduledFirestoreBackup integration behavior', () => {
	it('builds the export request from the active project id', async () => {
		const backgroundMock = createBackgroundAdminMock();
		backgroundMock.databasePath.mockReturnValue(
			'projects/santas-workshop-test/databases/(default)',
		);
		backgroundMock.exportDocuments.mockResolvedValue([
			{ name: 'backup-op-1' },
		]);
		process.env['GCLOUD_PROJECT'] = 'santas-workshop-test';

		vi.resetModules();
		vi.doMock('firebase-admin', () => backgroundMock.module);
		const { default: scheduledFirestoreBackup } =
			await import('../../src/fn/scheduledFirestoreBackup');

		await scheduledFirestoreBackup();

		expect(backgroundMock.exportDocuments).toHaveBeenCalledWith({
			name: 'projects/santas-workshop-test/databases/(default)',
			outputUriPrefix: 'gs://santashop-backups',
			collectionIds: [],
		});
	});
});
