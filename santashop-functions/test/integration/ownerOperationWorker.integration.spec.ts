import { beforeEach, describe, expect, it, vi } from 'vitest';
import ownerOperationWorker, {
	executeYearlyReset,
} from '../../src/fn/ownerOperationWorker';
import { previewOwnerOperation } from '../../src/fn/ownerOperations';
import { applyRegistrationReviewAuthDenylist } from '../../src/utility/registration-review-denylist-auth';
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

	it('retains active registration-review bans when yearly reset deletes seasonal records and Auth accounts', async () => {
		const db = getFirestore();
		const auth = getAuth();
		const now = new Date('2026-09-10T12:00:00Z');
		const uid = 'banned-seasonal-shopper';
		const email = 'yearly-reset-ban@example.com';
		await auth.createUser({ uid, email, emailVerified: true });
		await db.doc('users/' + uid).set({ uid });
		await db.doc('registrations/' + uid).set({ uid, programYear: 2025 });
		await db.doc('cancellations/yearly-reset-cancellation').set({ uid });
		const operationId = 'yearly-reset-block';
		const emailBlock = db.doc('registrationReviewEmailBlocks/' + email);
		const uidBlock = db.doc('registrationReviewUidBlocks/' + uid);
		const audit = db.doc('registrationReviewBlockAudit/' + operationId);
		await emailBlock.set({ email, active: true, shopperUid: uid });
		await uidBlock.set({ active: true, shopperUid: uid });
		await audit.set({ kind: 'block', active: true });
		const revoke = vi.spyOn(auth, 'revokeRefreshTokens');
		await applyRegistrationReviewAuthDenylist({ uid, email }, auth);
		expect((await auth.getUser(uid)).disabled).toBe(true);
		expect(revoke).toHaveBeenCalledExactlyOnceWith(uid);
		const authOperation = db.doc('registrationReviewAuthOperations/' + uid);
		await authOperation.set({ state: 'confirmed', operationId });

		// Start at the already-verified purge stage (the emulator cannot export).
		const result = await executeYearlyReset('ban-retention-reset', {
			operation: 'yearly-reset',
			status: 'running',
			stage: 'purging-firestore',
			projectId: 'santas-workshop-test',
			programYear: 2025,
			actorUid: 'owner',
			createdAt: now,
			purgeStartedAt: now,
			backupOperationName: 'emulator/verified-backup',
			progress: {},
		});

		expect(result.deletedAuthUsers).toBe(1);
		await expect(auth.getUser(uid)).rejects.toMatchObject({
			code: 'auth/user-not-found',
		});
		expect((await db.doc('registrations/' + uid).get()).exists).toBe(false);
		expect(
			(await db.doc('cancellations/yearly-reset-cancellation').get())
				.exists,
		).toBe(false);
		// No original Auth UID is needed to reject this email in a new season.
		expect((await emailBlock.get()).data()).toEqual({
			email,
			active: true,
			shopperUid: uid,
		});
		expect((await uidBlock.get()).data()).toEqual({
			active: true,
			shopperUid: uid,
		});
		expect((await audit.get()).data()).toEqual({
			kind: 'block',
			active: true,
		});
		expect((await authOperation.get()).data()).toEqual({
			state: 'confirmed',
			operationId,
		});
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
			// Cross the SDK's 5,000-document recursive-delete page boundary.
		for (let offset = 0; offset < 6_001; offset += 100) {
			const batch = db.batch();
			for (let i = offset; i < Math.min(offset + 100, 6_001); i++) {
					batch.set(db.doc(`users/customer-${i}`), { payload: 'fixture' });
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
			// Two full 250-file pages plus a remainder exercise real Storage paging.
			for (let offset = 0; offset < 501; offset += 25) {
			await Promise.all(
					Array.from({ length: Math.min(25, 501 - offset) }, (_, i) =>
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
