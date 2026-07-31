import { describe, expect, it, vi } from 'vitest';

describe('ownerOperationWorker yearly reset', () => {
	it('performs no deletion when the Firestore backup fails', async () => {
		const recursiveDelete = vi.fn();
		const operationSet = vi.fn().mockResolvedValue(undefined);
		const getOperation = vi.fn().mockResolvedValue([
			{
				done: true,
				error: { message: 'export failed' },
			},
		]);
		const firestore = Object.assign(
			vi.fn(() => ({
				collection: vi.fn(() => ({
					doc: vi.fn(() => ({
						set: operationSet,
					})),
				})),
				recursiveDelete,
			})),
			{
				v1: {
					FirestoreAdminClient: class {
						public readonly operationsClient = { getOperation };

						public databasePath(
							projectId: string,
							databaseId: string,
						): string {
							return `projects/${projectId}/databases/${databaseId}`;
						}
					},
				},
			},
		);

		vi.resetModules();
		vi.doMock('firebase-admin', () => ({
			apps: [{}],
			initializeApp: vi.fn(),
			firestore,
		}));
		vi.doMock('firebase-admin/functions', () => ({
			getFunctions: vi.fn(),
		}));

		const { executeYearlyReset } = await import(
			'../../../src/fn/ownerOperationWorker'
		);

		await expect(
			executeYearlyReset('operation-1', {
				operation: 'yearly-reset',
				status: 'backing-up',
				projectId: 'santas-workshop-test',
				programYear: 2025,
				actorUid: 'owner-1',
				counts: {},
				progress: {},
				stage: 'waiting-for-backup',
				backupOperationName: 'operations/backup-1',
				backupLocation:
					'gs://santashop-backups/yearly-reset/2025/operation-1',
			}),
		).rejects.toThrow('Firestore backup failed: export failed');

		expect(getOperation).toHaveBeenCalledWith({
			name: 'operations/backup-1',
		});
		expect(recursiveDelete).not.toHaveBeenCalled();
	});
});
