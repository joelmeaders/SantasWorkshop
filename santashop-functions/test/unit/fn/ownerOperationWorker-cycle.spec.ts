import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

const START = new Date('2026-09-09T12:00:00Z');
const HOUR = 60 * 60 * 1000;
type Worker =
	(typeof import('../../../src/fn/ownerOperationWorker'))['default'];
type AdminMock = ReturnType<typeof createBackgroundAdminMock>;

const setup = async (
	overrides: Record<string, unknown> = {},
): Promise<{
	worker: Worker;
	adminMock: AdminMock;
	operation: Record<string, unknown>;
	enqueue: ReturnType<typeof vi.fn>;
	getOperation: ReturnType<typeof vi.fn>;
	recursiveDelete: ReturnType<typeof vi.fn>;
}> => {
	vi.useFakeTimers();
	vi.setSystemTime(START);
	const adminMock = createBackgroundAdminMock();
	const operation: Record<string, unknown> = {
		operation: 'yearly-reset',
		status: 'queued',
		stage: 'queued',
		projectId: 'santas-workshop-test',
		programYear: 2025,
		actorUid: 'owner-1',
		counts: {},
		progress: {},
		createdAt: START,
		...overrides,
	};
	const ref = adminMock.getDocRef('ownerOperations/reset-1');
	ref.get.mockImplementation(async () => ({
		exists: true,
		data: () => ({ ...operation }),
	}));
	ref.set.mockImplementation(async (update: Record<string, unknown>) => {
		Object.assign(operation, update);
	});
	const lockPath = 'ownerOperationLocks/yearly-reset';
	adminMock.setDocSnapshot(lockPath, { operationId: 'reset-1' });
	adminMock.getDocRef(lockPath).delete.mockImplementation(async () => {
		adminMock.setDocSnapshot(lockPath, {}, false);
	});
	const recursiveDelete = vi.fn().mockResolvedValue(undefined);
	const getOperation = vi.fn().mockResolvedValue([{ done: false }]);
	adminMock.exportDocuments.mockResolvedValue([
		{ name: 'operations/backup-1' },
	]);
	adminMock.module.firestore.v1.FirestoreAdminClient = class {
		public readonly databasePath = adminMock.databasePath;
		public readonly exportDocuments = adminMock.exportDocuments;
		public readonly operationsClient = { getOperation };
	};
	adminMock.module.firestore.mockImplementation(
		() =>
			({
				collection: adminMock.collection,
				runTransaction: adminMock.runTransaction,
				recursiveDelete,
			}) as never,
	);
	adminMock.setCollectionDocs('staff', []);
	adminMock.listUsers.mockResolvedValue({ users: [] });
	adminMock.module.storage.mockReturnValue({
		bucket: () => ({ getFiles: vi.fn().mockResolvedValue([[]]) }),
	});
	const enqueue = vi.fn().mockResolvedValue(undefined);
	vi.resetModules();
	vi.doMock('firebase-admin', () => ({
		...adminMock.module,
		app: vi.fn(() => ({})),
	}));
	vi.doMock('firebase-admin/functions', () => ({
		getFunctions: () => ({ taskQueue: () => ({ enqueue }) }),
	}));
	vi.doMock('../../../src/fn/ownerOperations', () => ({
		isOwnerOperationSeasonOpen: () => true,
		assertRecentMarketingExport: vi.fn().mockResolvedValue(undefined),
	}));
	const { default: worker } = await vi.importActual<{ default: Worker }>(
		'../../../src/fn/ownerOperationWorker',
	);
	return {
		worker,
		adminMock,
		operation,
		enqueue,
		getOperation,
		recursiveDelete,
	};
};

afterEach(() => {
	vi.useRealTimers();
	vi.doUnmock('../../../src/fn/ownerOperations');
});

describe('owner operation continuation limits', () => {
	it('expires a queued reset before starting a backup or deleting data', async () => {
		const { worker, adminMock, operation, enqueue, recursiveDelete } =
			await setup({ createdAt: new Date(START.getTime() - HOUR) });
		await expect(
			worker({ data: { operationId: 'reset-1' } }),
		).resolves.toBeUndefined();
		expect(operation).toMatchObject({
			status: 'failed',
			stage: 'backup-timeout',
		});
		expect(operation['errorMessage']).toContain('export may still finish');
		expect(adminMock.exportDocuments).not.toHaveBeenCalled();
		expect(enqueue).not.toHaveBeenCalled();
		expect(recursiveDelete).not.toHaveBeenCalled();
		expect(
			adminMock.getDocRef('ownerOperationLocks/yearly-reset').delete,
		).toHaveBeenCalledOnce();
	});

	it('continues a pending backup within the original budget and retains the lock', async () => {
		const {
			worker,
			adminMock,
			operation,
			enqueue,
			getOperation,
			recursiveDelete,
		} = await setup({ backupOperationName: 'operations/backup-1' });
		await worker({ data: { operationId: 'reset-1' } });
		expect(operation).toMatchObject({
			status: 'backing-up',
			stage: 'waiting-for-backup',
			createdAt: START,
		});
		expect(getOperation).toHaveBeenCalledWith({
			name: 'operations/backup-1',
		});
		expect(enqueue).toHaveBeenCalledWith(
			{ operationId: 'reset-1' },
			{ scheduleDelaySeconds: 30 },
		);
		expect(recursiveDelete).not.toHaveBeenCalled();
		expect(
			adminMock.getDocRef('ownerOperationLocks/yearly-reset').delete,
		).not.toHaveBeenCalled();
	});

	it('does not begin deletion if the backup response crosses the deadline', async () => {
		const { worker, operation, getOperation, recursiveDelete, enqueue } =
			await setup({ backupOperationName: 'operations/backup-1' });
		getOperation.mockImplementation(async () => {
			vi.setSystemTime(START.getTime() + HOUR);
			return [{ done: true }];
		});
		await worker({ data: { operationId: 'reset-1' } });
		expect(operation['stage']).toBe('backup-timeout');
		expect(operation['purgeStartedAt']).toBeUndefined();
		expect(recursiveDelete).not.toHaveBeenCalled();
		expect(enqueue).not.toHaveBeenCalled();
	});

	it('saves an accepted backup handle even if starting it crosses the deadline', async () => {
		const { worker, adminMock, operation, enqueue } = await setup();
		adminMock.exportDocuments.mockImplementation(async () => {
			vi.setSystemTime(START.getTime() + HOUR);
			return [{ name: 'operations/slow-backup' }];
		});
		await worker({ data: { operationId: 'reset-1' } });
		expect(operation).toMatchObject({
			stage: 'backup-timeout',
			backupOperationName: 'operations/slow-backup',
		});
		expect(operation['backupLocation']).toContain(
			'/yearly-reset/2025/reset-1',
		);
		expect(enqueue).not.toHaveBeenCalled();
	});

	it('retries timeout lock cleanup without clearing the terminal stage or restarting work', async () => {
		const { worker, adminMock, operation, enqueue } = await setup({
			createdAt: new Date(START.getTime() - HOUR),
		});
		const lock = adminMock.getDocRef('ownerOperationLocks/yearly-reset');
		lock.delete.mockRejectedValueOnce(
			new Error('temporary lock write failure'),
		);
		await expect(
			worker({ data: { operationId: 'reset-1' } }),
		).rejects.toThrow('temporary lock write failure');
		expect(operation['stage']).toBe('backup-timeout');
		const ref = adminMock.getDocRef('ownerOperations/reset-1');
		ref.set.mockClear();
		await worker({ data: { operationId: 'reset-1' } });
		expect(lock.delete).toHaveBeenCalledTimes(2);
		expect(ref.set).not.toHaveBeenCalled();
		expect(enqueue).not.toHaveBeenCalled();
		expect(adminMock.exportDocuments).not.toHaveBeenCalled();
	});

	it('does not release a replacement lock when an old timed-out task arrives', async () => {
		const { worker, adminMock } = await setup({
			status: 'failed',
			stage: 'backup-timeout',
		});
		adminMock.setDocSnapshot('ownerOperationLocks/yearly-reset', {
			operationId: 'newer-reset',
		});
		await worker({ data: { operationId: 'reset-1' } });
		expect(adminMock.runTransaction).toHaveBeenCalledOnce();
		expect(
			adminMock.getDocRef('ownerOperationLocks/yearly-reset').delete,
		).not.toHaveBeenCalled();
	});

	it('surfaces lock transaction failure without changing the terminal operation', async () => {
		const { worker, adminMock, operation } = await setup({
			status: 'failed',
			stage: 'backup-timeout',
		});
		adminMock.runTransaction.mockRejectedValueOnce(
			new Error('transaction unavailable'),
		);
		await expect(
			worker({ data: { operationId: 'reset-1' } }),
		).rejects.toThrow('transaction unavailable');
		expect(operation['stage']).toBe('backup-timeout');
		expect(
			adminMock.getDocRef('ownerOperations/reset-1').set,
		).not.toHaveBeenCalled();
	});

	it('persists the purge marker before deletion and resumes partial work after the deadline', async () => {
		const { worker, operation, getOperation, recursiveDelete, enqueue } =
			await setup({ backupOperationName: 'operations/backup-1' });
		getOperation.mockResolvedValue([{ done: true }]);
		recursiveDelete.mockImplementationOnce(async () => {
			expect(operation['purgeStartedAt']).toEqual(START);
			throw new Error('partial deletion failed');
		});
		await expect(
			worker({ data: { operationId: 'reset-1' } }),
		).rejects.toThrow('partial deletion failed');
		expect(operation).toMatchObject({
			status: 'failed',
			stage: 'failed',
			purgeStartedAt: START,
		});
		vi.setSystemTime(START.getTime() + 2 * HOUR);
		await worker({ data: { operationId: 'reset-1' } });
		expect(operation['status']).toBe('succeeded');
		expect(getOperation).toHaveBeenCalledOnce();
		expect(recursiveDelete.mock.calls.length).toBeGreaterThan(1);
		expect(enqueue).not.toHaveBeenCalled();
	});

	it('does not delete anything when the purge marker cannot be persisted', async () => {
		const { worker, adminMock, operation, getOperation, recursiveDelete } =
			await setup({ backupOperationName: 'operations/backup-1' });
		getOperation.mockResolvedValue([{ done: true }]);
		adminMock
			.getDocRef('ownerOperations/reset-1')
			.set.mockImplementation(async (update: Record<string, unknown>) => {
				if (update['purgeStartedAt'])
					throw new Error('marker write failed');
				Object.assign(operation, update);
			});
		await expect(
			worker({ data: { operationId: 'reset-1' } }),
		).rejects.toThrow('marker write failed');
		expect(recursiveDelete).not.toHaveBeenCalled();
	});

	it('preserves retries for ordinary failures within the backup budget', async () => {
		const { worker, operation, getOperation, enqueue } = await setup({
			backupOperationName: 'operations/backup-1',
		});
		getOperation.mockRejectedValueOnce(new Error('temporary RPC failure'));
		await expect(
			worker({ data: { operationId: 'reset-1' } }),
		).rejects.toThrow('temporary RPC failure');
		expect(operation).toMatchObject({ status: 'failed', stage: 'failed' });
		await worker({ data: { operationId: 'reset-1' } });
		expect(enqueue).toHaveBeenCalledOnce();
		expect(operation['status']).toBe('backing-up');
	});

	it.each([undefined, null, 'invalid', new Date(Number.NaN)])(
		'rejects an invalid creation timestamp (%s) without extending the budget',
		async (createdAt) => {
			const { worker, adminMock, enqueue, recursiveDelete } = await setup(
				{ createdAt },
			);
			await expect(
				worker({ data: { operationId: 'reset-1' } }),
			).rejects.toThrow('invalid createdAt');
			expect(adminMock.exportDocuments).not.toHaveBeenCalled();
			expect(enqueue).not.toHaveBeenCalled();
			expect(recursiveDelete).not.toHaveBeenCalled();
		},
	);
});
