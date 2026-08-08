import { describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

describe('ownerOperationWorker yearly reset', () => {
	const queuedOperation = (
		operation: string,
		overrides: Record<string, unknown> = {},
	): Record<string, unknown> => ({
		operation,
		status: 'queued',
		projectId: 'santas-workshop-test',
		programYear: 2025,
		actorUid: 'owner-1',
		counts: {},
		progress: {},
		stage: 'queued',
		...overrides,
	});

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

	it('completes a reminder queue operation and releases its lock', async () => {
		const adminMock = createBackgroundAdminMock();
		const queueReminderEmailsMock = vi.fn().mockResolvedValue({
			success: 3,
			failed: 1,
		});
		adminMock.setDocSnapshot('ownerOperations/operation-2', {
			operation: 'queue-reminder-emails',
			status: 'queued',
			projectId: 'santas-workshop-test',
			programYear: 2025,
			actorUid: 'owner-1',
			counts: { eligibleRegistrations: 5 },
			progress: {},
			stage: 'queued',
		});
		adminMock
			.getDocRef('ownerOperationLocks/queue-reminder-emails')
			.delete.mockResolvedValue(undefined);
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
		vi.doMock('firebase-admin/functions', () => ({ getFunctions: vi.fn() }));
		vi.doMock('../../../src/fn/queueReminderEmails', () => ({
			default: queueReminderEmailsMock,
		}));

		const worker = (await import('../../../src/fn/ownerOperationWorker')).default;
		await expect(worker({ data: { operationId: 'operation-2' } })).resolves.toBeUndefined();

		expect(queueReminderEmailsMock).toHaveBeenCalledWith(2025);
		expect(adminMock.getDocRef('ownerOperations/operation-2').set).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'succeeded',
				stage: 'completed',
				result: expect.objectContaining({ queued: 3, failed: 1, skipped: 1 }),
			}),
			{ merge: true },
		);
		expect(adminMock.getDocRef('ownerOperationLocks/queue-reminder-emails').delete)
			.toHaveBeenCalledTimes(1);
	});

	it('marks a failed worker operation and still releases its lock', async () => {
		const adminMock = createBackgroundAdminMock();
		const queueReminderEmailsMock = vi
			.fn()
			.mockRejectedValue(new Error('queue unavailable'));
		adminMock.setDocSnapshot('ownerOperations/operation-3', {
			operation: 'queue-reminder-emails',
			status: 'queued',
			projectId: 'santas-workshop-test',
			programYear: 2025,
			actorUid: 'owner-1',
			counts: {},
			progress: {},
			stage: 'queued',
		});
		adminMock
			.getDocRef('ownerOperationLocks/queue-reminder-emails')
			.delete.mockResolvedValue(undefined);
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
		vi.doMock('firebase-admin/functions', () => ({ getFunctions: vi.fn() }));
		vi.doMock('../../../src/fn/queueReminderEmails', () => ({
			default: queueReminderEmailsMock,
		}));

		const worker = (await import('../../../src/fn/ownerOperationWorker')).default;
		await expect(worker({ data: { operationId: 'operation-3' } })).rejects.toThrow(
			'queue unavailable',
		);

		expect(adminMock.getDocRef('ownerOperations/operation-3').set).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'failed',
				stage: 'failed',
				errorMessage: 'queue unavailable',
			}),
			{ merge: true },
		);
		expect(adminMock.getDocRef('ownerOperationLocks/queue-reminder-emails').delete)
			.toHaveBeenCalledTimes(1);
	});

	it('starts a Firestore export and defers yearly reset deletion until the backup completes', async () => {
		const adminMock = createBackgroundAdminMock();
		const enqueue = vi.fn().mockResolvedValue(undefined);
		(adminMock.module as unknown as { app: ReturnType<typeof vi.fn> }).app =
			vi.fn(() => ({}));
		adminMock.databasePath.mockReturnValue(
			'projects/santas-workshop-test/databases/(default)',
		);
		adminMock.exportDocuments.mockResolvedValue([{ name: 'operations/backup-1' }]);
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
		vi.doMock('firebase-admin/functions', () => ({
			getFunctions: vi.fn(() => ({
				taskQueue: vi.fn(() => ({ enqueue })),
			})),
		}));

		const { executeYearlyReset } = await import(
			'../../../src/fn/ownerOperationWorker'
		);
		await expect(
			executeYearlyReset('operation-4', {
				operation: 'yearly-reset',
				status: 'queued',
				projectId: 'santas-workshop-test',
				programYear: 2025,
				actorUid: 'owner-1',
				counts: {},
				progress: {},
				stage: 'queued',
			}),
		).resolves.toEqual({
			message: 'Firestore backup started.',
			deferred: true,
		});

		expect(adminMock.exportDocuments).toHaveBeenCalledWith(
			expect.objectContaining({ collectionIds: [] }),
		);
		expect(enqueue).toHaveBeenCalledWith(
			{ operationId: 'operation-4' },
			{ scheduleDelaySeconds: 30 },
		);
	});

	it('releases an already-completed operation lock without rerunning work', async () => {
		const adminMock = createBackgroundAdminMock();
		adminMock.setDocSnapshot('ownerOperations/done', queuedOperation('queue-reminder-emails', { status: 'succeeded' }));
		adminMock.getDocRef('ownerOperationLocks/queue-reminder-emails').delete.mockResolvedValue(undefined);
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
		vi.doMock('firebase-admin/functions', () => ({ getFunctions: vi.fn() }));

		const worker = (await import('../../../src/fn/ownerOperationWorker')).default;
		await worker({ data: { operationId: 'done' } });

		expect(adminMock.getDocRef('ownerOperationLocks/queue-reminder-emails').delete).toHaveBeenCalledTimes(1);
		expect(adminMock.getDocRef('ownerOperations/done').set).not.toHaveBeenCalled();
	});

	it('fails clearly when the requested operation record is absent', async () => {
		const adminMock = createBackgroundAdminMock();
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
		vi.doMock('firebase-admin/functions', () => ({ getFunctions: vi.fn() }));

		const worker = (await import('../../../src/fn/ownerOperationWorker')).default;
		await expect(worker({ data: { operationId: 'missing' } })).rejects.toThrow(
			'Owner operation missing does not exist.',
		);
	});

	it('repairs only missing registration check-in flags and completes the operation', async () => {
		const adminMock = createBackgroundAdminMock();
		const writerSet = vi.fn();
		const writerClose = vi.fn().mockResolvedValue(undefined);
		adminMock.setDocSnapshot('ownerOperations/repair', queuedOperation('repair-checkin-flags'));
		adminMock.getDocRef('ownerOperationLocks/repair-checkin-flags').delete.mockResolvedValue(undefined);
		const registration = adminMock.getDocRef('registrations/customer-1');
		registration.get.mockResolvedValue({ exists: true, data: () => ({ hasCheckedIn: false }) });
		adminMock.getCollectionRef('checkins').get.mockResolvedValue({
			docs: [
				{ id: 'customer-1', data: () => ({ customerId: 'customer-1' }) },
				{ id: 'onsite', data: () => ({ customerId: 'onsite' }) },
			],
		});
		adminMock.module.firestore.mockImplementation(
			() => ({
				collection: adminMock.collection,
				bulkWriter: () => ({ set: writerSet, close: writerClose }),
			}) as never,
		);
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
		vi.doMock('firebase-admin/functions', () => ({ getFunctions: vi.fn() }));

		const worker = (await import('../../../src/fn/ownerOperationWorker')).default;
		await worker({ data: { operationId: 'repair' } });

		expect(writerSet).toHaveBeenCalledWith(registration, { hasCheckedIn: true }, { merge: true });
		expect(writerClose).toHaveBeenCalledTimes(1);
		expect(adminMock.getDocRef('ownerOperations/repair').set).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'succeeded', result: expect.objectContaining({ repaired: 1 }) }),
			{ merge: true },
		);
	});

	it('initializes only missing schedule slots and reports created versus skipped', async () => {
		const adminMock = createBackgroundAdminMock();
		const writerCreate = vi.fn();
		const writerClose = vi.fn().mockResolvedValue(undefined);
		adminMock.setDocSnapshot('ownerOperations/schedule', queuedOperation('initialize-schedule', {
			programYear: 2026,
			slots: [
				{ programYear: 2026, dateTime: '2026-12-10T18:00:00.000Z', maxSlots: 10, enabled: true },
				{ programYear: 2026, dateTime: '2026-12-11T18:00:00.000Z', maxSlots: 12, enabled: false },
			],
		}));
		adminMock.getDocRef('ownerOperationLocks/initialize-schedule').delete.mockResolvedValue(undefined);
		adminMock.module.firestore.mockImplementation(
			() => ({
				collection: adminMock.collection,
				getAll: vi.fn().mockResolvedValue([{ exists: false }, { exists: true }]),
				bulkWriter: () => ({ create: writerCreate, close: writerClose }),
			}) as never,
		);
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
		vi.doMock('firebase-admin/functions', () => ({ getFunctions: vi.fn() }));

		const worker = (await import('../../../src/fn/ownerOperationWorker')).default;
		await worker({ data: { operationId: 'schedule' } });

		expect(writerCreate).toHaveBeenCalledTimes(1);
		expect(adminMock.getDocRef('ownerOperations/schedule').set).toHaveBeenCalledWith(
			expect.objectContaining({ result: expect.objectContaining({ created: 1, skipped: 1 }) }),
			{ merge: true },
		);
	});

	it('rebuilds yearly check-in statistics from eligible records', async () => {
		const adminMock = createBackgroundAdminMock();
		const writerSet = vi.fn();
		const writerClose = vi.fn().mockResolvedValue(undefined);
		adminMock.setDocSnapshot('ownerOperations/stats', queuedOperation('rebuild-checkin-stats'));
		adminMock.getDocRef('ownerOperationLocks/rebuild-checkin-stats').delete.mockResolvedValue(undefined);
		const includedRef = adminMock.getDocRef('checkins/included');
		adminMock.getCollectionRef('checkins').get.mockResolvedValue({
			docs: [
				{ ref: includedRef, data: () => ({ checkInDateTime: new Date('2025-12-11T01:00:00.000Z'), registrationCode: 'ABC', stats: { children: 2 } }) },
				{ ref: adminMock.getDocRef('checkins/other-year'), data: () => ({ checkInDateTime: new Date('2024-12-11T01:00:00.000Z'), registrationCode: 'onsite' }) },
			],
		});
		adminMock.module.firestore.mockImplementation(
			() => ({
				collection: adminMock.collection,
				bulkWriter: () => ({ set: writerSet, close: writerClose }),
			}) as never,
		);
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
		vi.doMock('firebase-admin/functions', () => ({ getFunctions: vi.fn() }));

		const worker = (await import('../../../src/fn/ownerOperationWorker')).default;
		await worker({ data: { operationId: 'stats' } });

		expect(writerSet).toHaveBeenCalledWith(includedRef, { inStats: true }, { merge: true });
		expect(writerSet).toHaveBeenCalledWith(
			adminMock.getDocRef('stats/checkin-2025'),
			expect.objectContaining({ dateTimeCount: [expect.objectContaining({ customerCount: 1, childCount: 2 })] }),
			{ merge: false },
		);
	});

	it('writes a private export and completes the operation', async () => {
		const adminMock = createBackgroundAdminMock();
		const save = vi.fn().mockResolvedValue(undefined);
		adminMock.setDocSnapshot('ownerOperations/export', queuedOperation('export-marketing-emails'));
		adminMock.getDocRef('ownerOperationLocks/export-marketing-emails').delete.mockResolvedValue(undefined);
		adminMock.setCollectionDocs('users', [
			{ id: 'user-1', data: { emailAddress: 'elf@example.com', firstName: 'Buddy', lastName: 'Elf', zipCode: '80205' } },
		]);
		adminMock.module.storage.mockImplementation(
			() => ({ bucket: () => ({ file: () => ({ save }), getFiles: vi.fn().mockResolvedValue([[]]) }) }) as never,
		);
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
		vi.doMock('firebase-admin/functions', () => ({ getFunctions: vi.fn() }));

		const worker = (await import('../../../src/fn/ownerOperationWorker')).default;
		await worker({ data: { operationId: 'export' } });

		expect(save).toHaveBeenCalledWith(
			expect.stringContaining('elf@example.com'),
			expect.objectContaining({ contentType: 'text/csv; charset=utf-8', resumable: false }),
		);
		expect(adminMock.getDocRef('ownerOperations/export').set).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'succeeded', exportPath: 'owner-exports/marketing/export.csv' }),
			{ merge: true },
		);
	});
});
