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
	getFiles: ReturnType<typeof vi.fn>;
	deleteFile: ReturnType<typeof vi.fn>;
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
				getAll: adminMock.getAll,
				runTransaction: adminMock.runTransaction,
				recursiveDelete,
			}) as never,
	);
	adminMock.setCollectionDocs('staff', []);
	adminMock.listUsers.mockResolvedValue({ users: [] });
	const getFiles = vi.fn().mockResolvedValue([[]]);
	const deleteFile = vi.fn().mockResolvedValue(undefined);
	adminMock.module.storage.mockReturnValue({
		bucket: () => ({ getFiles, file: () => ({ delete: deleteFile }) }),
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
		getFiles,
		deleteFile,
	};
};

afterEach(() => {
	vi.useRealTimers();
	vi.doUnmock('../../../src/fn/ownerOperations');
});

describe('owner operation continuation limits', () => {
	it('deletes a large QR inventory with at most one page and ten deletes in flight', async () => {
		const { worker, getOperation, getFiles, deleteFile, operation } =
			await setup({ backupOperationName: 'operations/backup-1' });
		getOperation.mockResolvedValue([{ done: true }]);
		let deleted = 0;
		let active = 0;
		let peak = 0;
		getFiles.mockImplementation(
			async (query: {
				pageToken?: string;
				maxResults: number;
				autoPaginate: boolean;
			}) => {
				const page = Number(query.pageToken ?? 0);
				expect(deleted).toBe(page * 250);
				expect(active).toBe(0);
				expect(query).toMatchObject({
					maxResults: 250,
					autoPaginate: false,
				});
				return [
					Array.from({ length: 250 }, (_, i) => ({
						name: `registrations/${page * 250 + i}`,
					})),
					page < 49 ? { pageToken: String(page + 1) } : undefined,
				];
			},
		);
		deleteFile.mockImplementation(async () => {
			active++;
			peak = Math.max(peak, active);
			await Promise.resolve();
			active--;
			deleted++;
		});
		await worker({ data: { operationId: 'reset-1' } });
		expect(deleted).toBe(12_500);
		expect(peak).toBe(10);
		expect(deleteFile).toHaveBeenCalledWith({ ignoreNotFound: true });
		expect(operation['progress']).toMatchObject({ qrComplete: 1 });
	});

	it('waits for in-flight QR deletes before reporting a failure or releasing the lock', async () => {
		const {
			worker,
			adminMock,
			getOperation,
			getFiles,
			deleteFile,
			operation,
		} = await setup({ backupOperationName: 'operations/backup-1' });
		getOperation.mockResolvedValue([{ done: true }]);
		getFiles.mockResolvedValue([
			Array.from({ length: 10 }, (_, i) => ({
				name: `registrations/${i}`,
			})),
			{ pageToken: 'next-page' },
		]);
		let finish: (() => void) | undefined;
		const pending = new Promise<void>((resolve) => {
			finish = resolve;
		});
		deleteFile
			.mockRejectedValueOnce(new Error('delete failed'))
			.mockImplementationOnce(() => pending);
		const result = expect(
			worker({ data: { operationId: 'reset-1' } }),
		).rejects.toThrow('delete failed');
		await vi.waitFor(() => expect(deleteFile).toHaveBeenCalledTimes(10));
		expect(operation['status']).toBe('running');
		expect(operation['progress']).not.toHaveProperty('qrComplete');
		expect(
			adminMock.getDocRef('ownerOperationLocks/yearly-reset').delete,
		).not.toHaveBeenCalled();
		finish?.();
		await result;
		expect(getFiles).toHaveBeenCalledOnce();
		expect(operation['status']).toBe('failed');
		expect(operation['progress']).not.toHaveProperty('qrComplete');
	});

	it('deletes each Auth page before fetching the next and retains every staff protection', async () => {
		const { worker, adminMock, operation, getOperation, getFiles } =
			await setup({ backupOperationName: 'operations/backup-1' });
		getOperation.mockResolvedValue([{ done: true }]);
		adminMock.setDocSnapshot('staff/staff-record', { roles: [] });
		let deleted = 0;
		const requestTimes: number[] = [];
		adminMock.listUsers.mockImplementation(
			async (limit: number, token?: string) => {
				expect(limit).toBe(250);
				const page = Number(token ?? 0);
				expect(deleted).toBe(page * 250);
				if (page === 50)
					return {
						users: [
							{ uid: 'staff-record' },
							{ uid: 'owner', customClaims: { owner: true } },
							{
								uid: 'staff-claim',
								customClaims: { roles: ['admin'] },
							},
						],
					};
				return {
					users: Array.from({ length: limit }, (_, i) => ({
						uid: `customer-${page * limit + i}`,
						disabled: i % 2 === 0,
					})),
					pageToken: String(page + 1),
				};
			},
		);
		adminMock.deleteUsers.mockImplementation(async (uids: string[]) => {
			requestTimes.push(Date.now());
			expect(uids).toHaveLength(250);
			expect(uids.every((uid) => uid.startsWith('customer-'))).toBe(true);
			deleted += uids.length;
			return { successCount: uids.length, failureCount: 0, errors: [] };
		});
		const run = worker({ data: { operationId: 'reset-1' } });
		await vi.runAllTimersAsync();
		await run;
		expect(deleted).toBe(12_500);
		expect(requestTimes).toHaveLength(50);
		for (let index = 1; index < requestTimes.length; index++) {
			expect(
				requestTimes[index] - requestTimes[index - 1],
			).toBeGreaterThanOrEqual(1000);
		}
		expect(
			adminMock.getAll.mock.calls.every((args) => args.length <= 251),
		).toBe(true);
		expect(adminMock.getAll.mock.calls[0].at(-1)).toEqual({
			fieldMask: [],
		});
		expect(operation).toMatchObject({
			status: 'succeeded',
			progress: {
				deletedAuthUsers: 12_500,
				authComplete: 1,
				qrComplete: 1,
			},
		});
		expect(getFiles).toHaveBeenCalledExactlyOnceWith({
			prefix: 'registrations/',
			fields: 'items(name),nextPageToken',
			autoPaginate: false,
			maxResults: 250,
		});
		expect(operation['result']).not.toHaveProperty('deletedQrImages');
	});

	it('resumes partial Auth failures without reporting success or repeating completed collection deletes', async () => {
		const {
			worker,
			adminMock,
			operation,
			getOperation,
			recursiveDelete,
			getFiles,
		} = await setup({ backupOperationName: 'operations/backup-1' });
		getOperation.mockResolvedValue([{ done: true }]);
		adminMock.listUsers
			.mockResolvedValueOnce({ users: [{ uid: 'one' }, { uid: 'two' }] })
			.mockResolvedValue({ users: [{ uid: 'two' }] });
		adminMock.deleteUsers
			.mockResolvedValueOnce({
				successCount: 1,
				failureCount: 1,
				errors: [],
			})
			.mockResolvedValue({
				successCount: 1,
				failureCount: 0,
				errors: [],
			});
		const failedRun = expect(
			worker({ data: { operationId: 'reset-1' } }),
		).rejects.toThrow('Failed to delete 1');
		await vi.runAllTimersAsync();
		await failedRun;
		expect(operation).toMatchObject({
			status: 'failed',
			progress: { deletedAuthUsers: 1 },
		});
		expect(operation['progress']).not.toHaveProperty('authComplete');
		expect(getFiles).not.toHaveBeenCalled();
		recursiveDelete.mockClear();
		const retry = worker({ data: { operationId: 'reset-1' } });
		await vi.runAllTimersAsync();
		await retry;
		expect(operation).toMatchObject({
			status: 'succeeded',
			result: { deletedAuthUsers: 2 },
		});
		expect(recursiveDelete).not.toHaveBeenCalled();
		expect(getOperation).toHaveBeenCalledOnce();
	});

	it.each(['auth/quota-exceeded', 'auth/too-many-requests'])(
		'retries %s on the same Auth batch without releasing the lock or double counting',
		async (code) => {
			const { worker, adminMock, operation, getOperation, enqueue } =
				await setup({ backupOperationName: 'operations/backup-1' });
			getOperation.mockResolvedValue([{ done: true }]);
			adminMock.listUsers
				.mockResolvedValueOnce({
					users: [{ uid: 'one' }],
					pageToken: 'next',
				})
				.mockResolvedValue({ users: [{ uid: 'two' }] });
			const requestTimes: number[] = [];
			adminMock.deleteUsers.mockImplementation(async () => {
				requestTimes.push(Date.now() - START.getTime());
				if (requestTimes.length === 2 || requestTimes.length === 3) {
					expect(operation['progress']).toMatchObject({
						deletedAuthUsers: 1,
					});
					expect(operation['status']).toBe('running');
					expect(
						adminMock.getDocRef('ownerOperationLocks/yearly-reset')
							.delete,
					).not.toHaveBeenCalled();
					throw Object.assign(
						new Error('Exceeded quota for batch deleting accounts'),
						{ code },
					);
				}
				return { successCount: 1, failureCount: 0, errors: [] };
			});
			const run = worker({ data: { operationId: 'reset-1' } });
			await vi.advanceTimersByTimeAsync(1099);
			expect(adminMock.deleteUsers).not.toHaveBeenCalled();
			await vi.runAllTimersAsync();
			await run;
			expect(requestTimes).toEqual([1100, 2200, 4400, 8800]);
			expect(adminMock.deleteUsers.mock.calls).toEqual([
				[['one']],
				[['two']],
				[['two']],
				[['two']],
			]);
			expect(operation).toMatchObject({
				status: 'succeeded',
				progress: { deletedAuthUsers: 2, authComplete: 1 },
			});
			expect(enqueue).not.toHaveBeenCalled();
		},
	);

	it.each([
		{ code: 'auth/quota-exceeded', attempts: 5 },
		{ code: 'auth/insufficient-permission', attempts: 1 },
		{ code: 'auth/internal-error', attempts: 1 },
	])(
		'stops after $attempts attempts for $code and preserves incomplete Auth state',
		async ({ code, attempts }) => {
			const {
				worker,
				adminMock,
				operation,
				getOperation,
				getFiles,
				enqueue,
			} = await setup({ backupOperationName: 'operations/backup-1' });
			getOperation.mockResolvedValue([{ done: true }]);
			adminMock.listUsers.mockResolvedValue({ users: [{ uid: 'one' }] });
			const error = Object.assign(new Error('Auth deletion failed'), {
				code,
			});
			adminMock.deleteUsers.mockRejectedValue(error);
			const run = expect(
				worker({ data: { operationId: 'reset-1' } }),
			).rejects.toBe(error);
			await vi.runAllTimersAsync();
			await run;
			expect(adminMock.deleteUsers).toHaveBeenCalledTimes(attempts);
			expect(operation['status']).toBe('failed');
			expect(operation['progress']).not.toHaveProperty('authComplete');
			expect(operation['progress']).not.toHaveProperty(
				'deletedAuthUsers',
			);
			expect(getFiles).not.toHaveBeenCalled();
			expect(enqueue).not.toHaveBeenCalled();
			expect(vi.getTimerCount()).toBe(0);
		},
	);

	it('retries failed QR deletion and skips it after recorded completion', async () => {
		const {
			worker,
			adminMock,
			operation,
			getOperation,
			recursiveDelete,
			getFiles,
		} = await setup({ backupOperationName: 'operations/backup-1' });
		getOperation.mockResolvedValue([{ done: true }]);
		getFiles.mockRejectedValueOnce(new Error('storage unavailable'));
		await expect(
			worker({ data: { operationId: 'reset-1' } }),
		).rejects.toThrow('storage unavailable');
		expect(operation['progress']).not.toHaveProperty('qrComplete');
		recursiveDelete.mockClear();
		adminMock.listUsers.mockClear();
		await worker({ data: { operationId: 'reset-1' } });
		expect(operation).toMatchObject({
			status: 'succeeded',
			progress: { qrComplete: 1 },
		});
		expect(getFiles).toHaveBeenCalledTimes(2);
		expect(recursiveDelete).not.toHaveBeenCalled();
		expect(adminMock.listUsers).not.toHaveBeenCalled();
		await worker({ data: { operationId: 'reset-1' } });
		expect(getFiles).toHaveBeenCalledTimes(2);
	});

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
