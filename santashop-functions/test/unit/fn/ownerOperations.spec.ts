import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

const getFunctionsMock = vi.fn();

describe('owner operation seasonal window', () => {
	it('accepts the first instant of January in the shop timezone', async () => {
		const { isOwnerOperationSeasonOpen } = await import(
			'../../../src/fn/ownerOperations'
		);
		expect(
			isOwnerOperationSeasonOpen(
				new Date('2026-01-01T07:00:00.000Z'),
			),
		).toBe(true);
	});

	it('accepts the final instant of September 15 in the shop timezone', async () => {
		const { isOwnerOperationSeasonOpen } = await import(
			'../../../src/fn/ownerOperations'
		);
		expect(
			isOwnerOperationSeasonOpen(
				new Date('2026-09-16T05:59:59.999Z'),
			),
		).toBe(true);
	});

	it('rejects the first instant of September 16 in the shop timezone', async () => {
		const { isOwnerOperationSeasonOpen } = await import(
			'../../../src/fn/ownerOperations'
		);
		expect(
			isOwnerOperationSeasonOpen(
				new Date('2026-09-16T06:00:00.000Z'),
			),
		).toBe(false);
	});
});

describe('owner operation callables', () => {
	let adminMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		adminMock = createBackgroundAdminMock();
		(adminMock.module as unknown as { app: ReturnType<typeof vi.fn> }).app =
			vi.fn(() => ({ options: { projectId: 'santas-workshop-test' } }));
		getFunctionsMock.mockReset();
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
		vi.doMock('firebase-admin/functions', () => ({
			getFunctions: getFunctionsMock,
		}));
	});

	const loadHandlers = async () => import('../../../src/fn/ownerOperations');
	const owner = { uid: 'owner-1', token: { owner: true } };

	it('creates a preview with an independently counted marketing audience', async () => {
		const { previewOwnerOperation } = await loadHandlers();
		adminMock.setCollectionCount('users', 7);

		const result = await previewOwnerOperation(
			{ data: { operation: 'export-marketing-emails' }, auth: owner } as never,
			new Date('2026-01-10T00:00:00.000Z'),
		);

		expect(result).toMatchObject({
			operation: 'export-marketing-emails',
			projectId: 'santas-workshop-test',
			counts: { users: 7 },
			confirmationPhrase: 'EXPORT MARKETING EMAILS santas-workshop-test',
			seasonRestricted: false,
		});
		expect(
			adminMock.getCollectionRef('ownerOperationPreviews').doc,
		).toHaveBeenCalledTimes(1);
	});

	it('validates and persists an initialize-schedule preview', async () => {
		const { previewOwnerOperation } = await loadHandlers();
		const now = new Date('2026-01-10T00:00:00.000Z');

		await expect(
			previewOwnerOperation(
				{
					data: {
						operation: 'initialize-schedule',
						programYear: 2026,
						slots: [
							{
								programYear: 2026,
								dateTime: '2026-12-10T18:00:00.000Z',
								maxSlots: 20,
								enabled: true,
							},
						],
					},
					auth: owner,
				} as never,
				now,
			),
		).resolves.toMatchObject({
			counts: { requestedSlots: 1 },
			seasonRestricted: true,
		});

		await expect(
			previewOwnerOperation(
				{ data: { operation: 'initialize-schedule', programYear: 2026, slots: [] }, auth: owner } as never,
				now,
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('rejects unauthenticated, out-of-season, and malformed previews', async () => {
		const { previewOwnerOperation } = await loadHandlers();
		const january = new Date('2026-01-10T00:00:00.000Z');

		await expect(
			previewOwnerOperation({ data: { operation: 'repair-checkin-flags' } } as never, january),
		).rejects.toMatchObject({ code: 'unauthenticated' });
		await expect(
			previewOwnerOperation({ data: { operation: 'not-real' }, auth: owner } as never, january),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		await expect(
			previewOwnerOperation(
				{ data: { operation: 'rebuild-checkin-stats', programYear: 2026 }, auth: owner } as never,
				new Date('2026-10-01T00:00:00.000Z'),
			),
		).rejects.toMatchObject({ code: 'failed-precondition' });
	});

	it('counts eligible reminders and registered-email exports from authoritative records', async () => {
		const { previewOwnerOperation } = await loadHandlers();
		adminMock.setCollectionDocs('registrations', [
			{ id: 'eligible', data: { registrationSubmittedOn: true, qrCodeGeneratedOn: true } },
			{ id: 'queued', data: { registrationSubmittedOn: true, qrCodeGeneratedOn: true, reminderEmailQueuedOn: true } },
			{ id: 'not-submitted', data: { qrCodeGeneratedOn: true } },
		]);
		const now = new Date('2026-01-10T00:00:00.000Z');

		await expect(
			previewOwnerOperation(
				{ data: { operation: 'queue-reminder-emails', programYear: 2025 }, auth: owner } as never,
				now,
			),
		).resolves.toMatchObject({ counts: { eligibleRegistrations: 1 } });
		await expect(
			previewOwnerOperation(
				{ data: { operation: 'export-registered-emails', programYear: 2025 }, auth: owner } as never,
				now,
			),
		).resolves.toMatchObject({ counts: { registrations: 2 } });
	});

	it('returns a normalized operation record and a temporary export URL', async () => {
		const { getOwnerExportUrl, getOwnerOperation } = await loadHandlers();
		const completedAt = new Date('2026-01-10T00:00:00.000Z');
		adminMock.setDocSnapshot('ownerOperations/op-1', {
			operation: 'export-marketing-emails',
			status: 'succeeded',
			projectId: 'santas-workshop-test',
			actorUid: 'owner-1',
			stage: 'completed',
			counts: { users: 7 },
			progress: { rows: 7 },
			result: { message: 'Created 7 row export.' },
			createdAt: completedAt,
			updatedAt: completedAt,
			completedAt,
			exportPath: 'owner-exports/marketing/op-1.csv',
		});
		const exportFile = adminMock.getFileRef('owner-exports/marketing/op-1.csv') as unknown as {
			getSignedUrl: ReturnType<typeof vi.fn>;
		};
		exportFile.getSignedUrl = vi.fn().mockResolvedValue(['https://example.test/export']);

		await expect(
			getOwnerOperation({ data: { operationId: ' op-1 ' }, auth: owner } as never),
		).resolves.toMatchObject({
			operation: 'export-marketing-emails',
			completedAt: completedAt.toISOString(),
		});
		await expect(
			getOwnerExportUrl(
				{ data: { operationId: 'op-1' }, auth: owner } as never,
				completedAt,
			),
		).resolves.toMatchObject({ url: 'https://example.test/export' });
	});

	it('consumes a matching preview, creates a lock, and enqueues the operation', async () => {
		const enqueue = vi.fn().mockResolvedValue(undefined);
		const transactionUpdate = vi.fn();
		const now = new Date('2026-01-10T00:00:00.000Z');
		adminMock.setDocSnapshot('ownerOperationPreviews/preview-1', {
			actorUid: 'owner-1',
			operation: 'queue-reminder-emails',
			projectId: 'santas-workshop-test',
			programYear: 2025,
			counts: { eligibleRegistrations: 4 },
			confirmationPhrase: 'QUEUE REMINDER EMAILS santas-workshop-test 2025',
			expiresAt: new Date(now.getTime() + 60_000),
		});
		adminMock
			.getDocRef('ownerOperationLocks/queue-reminder-emails')
			.get.mockResolvedValue({ exists: false, data: () => undefined });
		adminMock.runTransaction.mockImplementation(async (callback) =>
			callback({
				get: async (ref: { get: () => Promise<unknown> }) => ref.get(),
				create: vi.fn(),
				set: vi.fn(),
				update: transactionUpdate,
			}),
		);
		getFunctionsMock.mockReturnValue({
			taskQueue: vi.fn(() => ({ enqueue })),
		});
		const { startOwnerOperation } = await loadHandlers();

		await expect(
			startOwnerOperation(
				{
					data: {
						previewId: 'preview-1',
						confirmationPhrase:
							'QUEUE REMINDER EMAILS santas-workshop-test 2025',
					},
					auth: {
						...owner,
						token: { owner: true, auth_time: now.getTime() / 1000 },
					},
				} as never,
				now,
			),
		).resolves.toMatchObject({ status: 'queued' });
		expect(transactionUpdate).toHaveBeenCalledWith(
			adminMock.getDocRef('ownerOperationPreviews/preview-1'),
			{ consumedAt: now },
		);
		expect(enqueue).toHaveBeenCalledTimes(1);
	});

	it('rejects an expired preview before queueing an operation', async () => {
		const now = new Date('2026-01-10T00:00:00.000Z');
		adminMock.setDocSnapshot('ownerOperationPreviews/expired', {
			actorUid: 'owner-1', operation: 'queue-reminder-emails',
			projectId: 'santas-workshop-test', programYear: 2025, counts: {},
			confirmationPhrase: 'QUEUE REMINDER EMAILS santas-workshop-test 2025',
			expiresAt: new Date(now.getTime() - 1),
		});
		const { startOwnerOperation } = await loadHandlers();
		await expect(
			startOwnerOperation({
				data: { previewId: 'expired', confirmationPhrase: 'QUEUE REMINDER EMAILS santas-workshop-test 2025' },
				auth: { ...owner, token: { owner: true, auth_time: now.getTime() / 1000 } },
			} as never, now),
		).rejects.toMatchObject({ code: 'deadline-exceeded' });
	});

	it('rejects previews owned by someone else, consumed previews, and active locks', async () => {
		const now = new Date('2026-01-10T00:00:00.000Z');
		const basePreview = {
			operation: 'queue-reminder-emails', projectId: 'santas-workshop-test', programYear: 2025,
			counts: {}, confirmationPhrase: 'QUEUE REMINDER EMAILS santas-workshop-test 2025',
			expiresAt: new Date(now.getTime() + 60_000),
		};
		const { startOwnerOperation } = await loadHandlers();
		const start = (previewId: string) => startOwnerOperation({
			data: { previewId, confirmationPhrase: 'QUEUE REMINDER EMAILS santas-workshop-test 2025' },
			auth: { ...owner, token: { owner: true, auth_time: now.getTime() / 1000 } },
		} as never, now);

		adminMock.setDocSnapshot('ownerOperationPreviews/other-owner', { ...basePreview, actorUid: 'owner-2' });
		await expect(start('other-owner')).rejects.toMatchObject({ code: 'permission-denied' });
		adminMock.setDocSnapshot('ownerOperationPreviews/consumed', { ...basePreview, actorUid: 'owner-1', consumedAt: now });
		await expect(start('consumed')).rejects.toMatchObject({ code: 'already-exists' });
		adminMock.setDocSnapshot('ownerOperationPreviews/locked', { ...basePreview, actorUid: 'owner-1' });
		adminMock.getDocRef('ownerOperationLocks/queue-reminder-emails').get.mockResolvedValue({ exists: true, data: () => ({}) });
		await expect(start('locked')).rejects.toMatchObject({ code: 'aborted' });
	});

	it('requires a recent owner authentication and an exact confirmation phrase', async () => {
		const now = new Date('2026-01-10T00:00:00.000Z');
		const { startOwnerOperation } = await loadHandlers();
		await expect(
			startOwnerOperation({ data: { previewId: 'x', confirmationPhrase: 'x' }, auth: owner } as never, now),
		).rejects.toMatchObject({ code: 'failed-precondition' });
		adminMock.setDocSnapshot('ownerOperationPreviews/phrase', {
			actorUid: 'owner-1', operation: 'queue-reminder-emails', projectId: 'santas-workshop-test',
			programYear: 2025, counts: {}, confirmationPhrase: 'EXPECTED', expiresAt: new Date(now.getTime() + 60_000),
		});
		await expect(
			startOwnerOperation({
				data: { previewId: 'phrase', confirmationPhrase: 'WRONG' },
				auth: { ...owner, token: { owner: true, auth_time: now.getTime() / 1000 } },
			} as never, now),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('cleans up the operation and lock when enqueueing fails', async () => {
		const now = new Date('2026-01-10T00:00:00.000Z');
		adminMock.setDocSnapshot('ownerOperationPreviews/preview-fail', {
			actorUid: 'owner-1', operation: 'queue-reminder-emails', projectId: 'santas-workshop-test',
			programYear: 2025, counts: {}, confirmationPhrase: 'QUEUE REMINDER EMAILS santas-workshop-test 2025',
			expiresAt: new Date(now.getTime() + 60_000),
		});
		adminMock.getDocRef('ownerOperationLocks/queue-reminder-emails').get.mockResolvedValue({ exists: false, data: () => undefined });
		adminMock.runTransaction.mockImplementation(async (callback) =>
			callback({
				get: async (ref: { get: () => Promise<unknown> }) => ref.get(),
				create: vi.fn(),
				set: vi.fn(),
				update: vi.fn(),
			}),
		);
		getFunctionsMock.mockReturnValue({ taskQueue: vi.fn(() => ({ enqueue: vi.fn().mockRejectedValue(new Error('queue down')) })) });
		const { startOwnerOperation } = await loadHandlers();

		await expect(
			startOwnerOperation({
				data: { previewId: 'preview-fail', confirmationPhrase: 'QUEUE REMINDER EMAILS santas-workshop-test 2025' },
				auth: { ...owner, token: { owner: true, auth_time: now.getTime() / 1000 } },
			} as never, now),
		).rejects.toMatchObject({ code: 'internal' });
		expect(adminMock.getDocRef('ownerOperations/generated-0').set).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'failed', stage: 'enqueue-failed' }),
			{ merge: true },
		);
		expect(adminMock.getDocRef('ownerOperationLocks/queue-reminder-emails').delete).toHaveBeenCalled();
	});

	it('guards operation lookups and requires a completed export', async () => {
		const { getOwnerExportUrl, getOwnerOperation } = await loadHandlers();
		await expect(getOwnerOperation({ data: { operationId: '' }, auth: owner } as never)).rejects.toMatchObject({ code: 'invalid-argument' });
		await expect(getOwnerOperation({ data: { operationId: 'missing' }, auth: owner } as never)).rejects.toMatchObject({ code: 'not-found' });
		adminMock.setDocSnapshot('ownerOperations/no-export', {
			operation: 'export-marketing-emails', status: 'failed', projectId: 'santas-workshop-test',
			actorUid: 'owner-1', counts: {}, progress: {}, stage: 'failed',
			createdAt: new Date(), updatedAt: new Date(),
		});
		await expect(getOwnerExportUrl({ data: { operationId: 'no-export' }, auth: owner } as never)).rejects.toMatchObject({ code: 'failed-precondition' });
	});
});
