import { beforeEach, describe, expect, it } from 'vitest';
import ownerOperationWorker, {
	executeYearlyReset,
} from '../../src/fn/ownerOperationWorker';
import { previewOwnerOperation } from '../../src/fn/ownerOperations';
import {
	clearEmulatorData,
	getAdminApp,
	getAuth,
	getFirestore,
} from '../helpers/admin-emulator';

describe.sequential('owner operation terminal lock cleanup integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it.each([
		{ status: 'failed', stage: 'backup-timeout' },
		{ status: 'succeeded', stage: 'completed' },
	])('releases only its own lock for $stage', async ({ status, stage }) => {
		const db = getFirestore();
		const operation = db.doc('ownerOperations/finished-reset');
		const lock = db.doc('ownerOperationLocks/yearly-reset');
		await operation.set({ operation: 'yearly-reset', status, stage });
		await lock.set({ operationId: 'finished-reset' });
		await ownerOperationWorker({ data: { operationId: 'finished-reset' } });
		expect((await lock.get()).exists).toBe(false);
		expect((await operation.get()).data()).toEqual({
			operation: 'yearly-reset',
			status,
			stage,
		});
		// A replay after cleanup also acknowledges without restarting the operation.
		await ownerOperationWorker({ data: { operationId: 'finished-reset' } });
		expect((await operation.get()).data()).toEqual({
			operation: 'yearly-reset',
			status,
			stage,
		});
	});

	it('preserves a newer operation lock when an old timeout is redelivered', async () => {
		const db = getFirestore();
		await db.doc('ownerOperations/old-reset').set({
			operation: 'yearly-reset',
			status: 'failed',
			stage: 'backup-timeout',
		});
		const lock = db.doc('ownerOperationLocks/yearly-reset');
		await lock.set({ operationId: 'new-reset' });
		await ownerOperationWorker({ data: { operationId: 'old-reset' } });
		expect((await lock.get()).data()).toEqual({ operationId: 'new-reset' });
	});

	it('purges paginated inventories and nested records while retaining staff and archives', async () => {
		const db = getFirestore();
		const auth = getAuth();
		const bucket = getAdminApp().storage().bucket();
		const now = new Date('2026-09-10T12:00:00Z');
		const ownerUid = 'customer-0010-owner';
		const staffUid = 'customer-0250-staff-record';
		const roleUid = 'customer-0500-staff-claim';
		const imported = await auth.importUsers([
			...Array.from({ length: 601 }, (_, i) => ({
				uid: `customer-${String(i).padStart(4, '0')}`,
				disabled: i % 2 === 0,
			})),
			{ uid: ownerUid, customClaims: { owner: true } },
			{ uid: staffUid },
			{ uid: roleUid, customClaims: { roles: ['admin'] } },
		]);
		expect(imported.failureCount).toBe(0);
		await db.doc(`staff/${staffUid}`).set({ retained: true });
		await db.doc('stats/2025').set({ retained: true });
		await db.doc('parameters/public').set({ retained: true });
		await db
			.doc('users/orphan/resetNested/child')
			.set({ payload: 'nested' });
		const payload = 'x'.repeat(16 * 1024);
		for (let offset = 0; offset < 6_001; offset += 100) {
			const batch = db.batch();
			for (let i = offset; i < Math.min(offset + 100, 6_001); i++) {
				batch.set(db.doc(`users/customer-${i}`), { payload });
			}
			await batch.commit();
		}
		const history = db.batch();
		for (let i = 0; i < 100; i++)
			history.set(db.doc(`ownerOperations/old-${i}`), {
				operation: 'export-marketing-emails',
				status: 'failed',
			});
		history.set(db.doc('ownerOperations/z-recent-export'), {
			operation: 'export-marketing-emails',
			status: 'succeeded',
			completedAt: now,
			exportPath: 'owner-exports/marketing/retained.csv',
		});
		await history.commit();
		await bucket
			.file('owner-exports/marketing/retained.csv')
			.save('retained', { resumable: false });
		for (let offset = 0; offset < 12_501; offset += 25) {
			await Promise.all(
				Array.from({ length: Math.min(25, 12_501 - offset) }, (_, i) =>
					bucket
						.file(
							`registrations/qr-${String(offset + i).padStart(4, '0')}.png`,
						)
						.save('qr', { resumable: false }),
				),
			);
		}
		const preview = await previewOwnerOperation(
			{
				data: { operation: 'yearly-reset', programYear: 2025 },
				auth: { uid: ownerUid, token: { owner: true } },
			} as never,
			now,
		);
		expect(preview.counts).toMatchObject({ authUsers: 601, users: 6_001 });
		expect(preview.counts).not.toHaveProperty('qrImages');

		// The emulator cannot export backups. Seed the already-verified purge stage.
		const baselineRss = process.memoryUsage().rss;
		let peakRss = baselineRss;
		const sample = setInterval(() => {
			peakRss = Math.max(peakRss, process.memoryUsage().rss);
		}, 20);
		try {
			const result = await executeYearlyReset('reset-fixture', {
				operation: 'yearly-reset',
				status: 'running',
				stage: 'purging-firestore',
				projectId: 'santas-workshop-test',
				programYear: 2025,
				actorUid: ownerUid,
				createdAt: now,
				purgeStartedAt: now,
				backupOperationName: 'emulator/verified-backup',
				counts: preview.counts,
				progress: {},
			});
			expect(result.deletedAuthUsers).toBe(601);
			expect(result).not.toHaveProperty('deletedQrImages');
		} finally {
			clearInterval(sample);
			console.info('Yearly reset emulator memory sample', {
				baselineRssMiB: Math.ceil(baselineRss / 1024 ** 2),
				peakRssMiB: Math.ceil(peakRss / 1024 ** 2),
			});
		}
		expect((await db.collection('users').count().get()).data().count).toBe(
			0,
		);
		expect((await db.collectionGroup('resetNested').get()).empty).toBe(
			true,
		);
		expect(
			(await auth.listUsers()).users.map((user) => user.uid).sort(),
		).toEqual([ownerUid, staffUid, roleUid].sort());
		expect(
			(
				await bucket.getFiles({
					prefix: 'registrations/',
					autoPaginate: false,
				})
			)[0],
		).toEqual([]);
		expect(
			(
				await bucket
					.file('owner-exports/marketing/retained.csv')
					.exists()
			)[0],
		).toBe(true);
		expect((await db.doc('stats/2025').get()).data()).toEqual({
			retained: true,
		});
		expect((await db.doc('parameters/public').get()).data()).toEqual({
			retained: true,
		});
		expect((await db.doc(`staff/${staffUid}`).get()).data()).toEqual({
			retained: true,
		});
		expect(
			(await db.doc('ownerOperations/reset-fixture').get()).data()?.[
				'progress'
			],
		).toMatchObject({ authComplete: 1, qrComplete: 1 });
	}, 300_000);
});
