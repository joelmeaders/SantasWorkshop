import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	createRegistrationReviewDenylist,
	type ReviewDenylistIntent,
} from '../../src/utility/registration-review-denylist';

let app: ReturnType<typeof initializeApp>;
let db: ReturnType<typeof getFirestore>;
let store: ReturnType<typeof createRegistrationReviewDenylist>;

const fixture = (): ReviewDenylistIntent => {
	const id = randomUUID();
	return {
		kind: 'block',
		email: id + '@example.test',
		shopperUid: 'shopper-' + id,
		actorUid: 'fixture-owner',
		caseId: 'case-' + id,
		cancellationId: 'cancel-' + id,
		reason: 'Reviewed synthetic cancellation',
		operationId: 'op-' + id,
	};
};

const apply = (
	intent: ReviewDenylistIntent,
): Promise<{ active: boolean; replayed: boolean }> =>
	db.runTransaction((tx) => store.apply(tx, intent));

describe.skipIf(process.env['REGISTRATION_REVIEW_DENYLIST_TEST'] !== 'true')(
	'isolated cross-season review denylist',
	() => {
		beforeAll(() => {
			if (process.env['FIRESTORE_EMULATOR_HOST'] !== '127.0.0.1:18082') {
				throw new Error(
					'Expected dedicated localhost review denylist emulator on port 18082.',
				);
			}
			app = initializeApp(
				{ projectId: 'demo-registration-review' },
				'review-denylist',
			);
			db = getFirestore(app);
			store = createRegistrationReviewDenylist(db, Buffer.alloc(32, 89));
		});

		afterAll(async () => {
			if (app) await deleteApp(app);
		});

		it('blocks the exact normalized address and UID without storing the email', async () => {
			const block = fixture();
			expect(await store.isEmailBlocked(block.email)).toBe(false);
			expect(await apply(block)).toEqual({
				active: true,
				replayed: false,
			});
			expect(await store.isUidBlocked(block.shopperUid)).toBe(true);
			expect(
				await store.isEmailBlocked(
					'  ' + block.email.toUpperCase() + ' ',
				),
			).toBe(true);
			expect(await store.isEmailBlocked('prefix-' + block.email)).toBe(
				false,
			);
			const audit = await db
				.collection('registrationReviewBlockAudit')
				.doc(block.operationId)
				.get();
			expect(audit.get('reason')).toBe(block.reason);
			const keyed = await db
				.collection('registrationReviewEmailBlocks')
				.doc(audit.get('emailKey'))
				.get();
			const marker = await db
				.collection('registrationReviewUidBlocks')
				.doc(block.shopperUid)
				.get();
			expect(keyed.id).toMatch(/^[a-f0-9]{64}$/u);
			expect(
				JSON.stringify([audit.data(), keyed.data(), marker.data()]),
			).not.toContain(block.email);
		});

		it('retains immutable audit events and never reactivates on an old replay', async () => {
			const block = fixture();
			await apply(block);
			const release: ReviewDenylistIntent = {
				...block,
				kind: 'unblock',
				operationId: randomUUID(),
				reason: 'Synthetic correction',
			};
			expect(await apply(release)).toEqual({
				active: false,
				replayed: false,
			});
			expect(await apply(block)).toEqual({
				active: true,
				replayed: true,
			});
			expect(await apply(release)).toEqual({
				active: false,
				replayed: true,
			});
			expect(await store.isEmailBlocked(block.email)).toBe(false);
			expect(await store.isUidBlocked(block.shopperUid)).toBe(false);
			const audit = db.collection('registrationReviewBlockAudit');
			expect(
				(await audit.doc(block.operationId).get()).get('reason'),
			).toBe(block.reason);
			expect(
				(await audit.doc(release.operationId).get()).get('reason'),
			).toBe(release.reason);
		});

		it('rejects stale targets, duplicate bindings, and changed payload replay', async () => {
			const block = fixture();
			await apply(block);
			await expect(
				apply({ ...block, reason: 'Different' }),
			).rejects.toMatchObject({ code: 'already-exists' });
			await expect(
				apply({
					...block,
					shopperUid: 'other-uid',
					operationId: randomUUID(),
				}),
			).rejects.toMatchObject({ code: 'failed-precondition' });
			await expect(
				apply({
					...block,
					email: 'other-' + block.email,
					operationId: randomUUID(),
				}),
			).rejects.toMatchObject({ code: 'failed-precondition' });
			await expect(
				apply({
					...block,
					kind: 'unblock',
					cancellationId: 'wrong-cancel',
					operationId: randomUUID(),
				}),
			).rejects.toMatchObject({ code: 'failed-precondition' });
			expect(await store.isEmailBlocked(block.email)).toBe(true);
		});

		it('leaves neither block nor audit receipt when the enclosing case transaction aborts', async () => {
			const block = fixture();
			await expect(
				db.runTransaction(async (tx) => {
					await store.apply(tx, block);
					throw new Error('Synthetic case transaction aborted');
				}),
			).rejects.toThrow('Synthetic case transaction aborted');
			expect(await store.isEmailBlocked(block.email)).toBe(false);
			expect(await store.isUidBlocked(block.shopperUid)).toBe(false);
			expect(
				(
					await db
						.collection('registrationReviewBlockAudit')
						.doc(block.operationId)
						.get()
				).exists,
			).toBe(false);
		});
	},
);
