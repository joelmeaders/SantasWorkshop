import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	recordRegistrationReviewDelta,
	runRegistrationReviewEmulatorBaseline,
	runRegistrationReviewNightly,
} from '../../src/utility/registration-review-nightly';

const SEASON = 2041;
const KEY = Buffer.alloc(32, 37);
const SUBMITTED_AT = new Date('2041-11-15T15:00:00Z');

describe.skipIf(process.env['REGISTRATION_REVIEW_NIGHTLY_TEST'] !== 'true')(
	'registration review nightly change intake and candidate index',
	() => {
		let app: App;
		let db: Firestore;

		beforeAll(() => {
			if (process.env['FIRESTORE_EMULATOR_HOST'] !== '127.0.0.1:18082')
				throw new Error(
					'Expected isolated review emulator on localhost:18082.',
				);
			app = initializeApp(
				{ projectId: 'demo-registration-review' },
				'nightly-review-test',
			);
			db = getFirestore(app);
		});

		afterAll(async () => {
			if (app) await deleteApp(app);
		});

		const source = (
			names = ['Juniper', 'Iris', 'Wren'],
			season = SEASON,
		): object => ({
			programYear: season,
			registrationSubmittedOn: SUBMITTED_AT,
			firstName: 'Fixture',
			lastName: 'Parent',
			zipCode: '80210',
			children: names.map((firstName, index) => ({
				firstName,
				lastName: 'Fixture',
				dateOfBirth: new Date(Date.UTC(2032, 2, 20 + index)),
				enabled: true,
			})),
		});

		it('matches a new applicant against flagged rosters, skips repeats and a stale cancellation, and respects the cutoff', async () => {
			const regs = db.collection('registrations');
			const review = db
				.collection('registrationReviewSeasons')
				.doc(String(SEASON));
			const index = review.collection('rosterIndex');
			const cases = review.collection('cases');
			const pending = review.collection('pendingRosters');
			const a = regs.doc('nightly_A');
			const b = regs.doc('nightly_B');
			const c = regs.doc('nightly_C');
			const d = regs.doc('nightly_D');
			const otherSeason = regs.doc('nightly_other_season');

			const aBefore = await a.get();
			await a.set(source());
			const aCreate = {
				id: 'a-create',
				before: aBefore,
				after: await a.get(),
			};
			const beforeCommit = new Date(Date.now() - 60_000);
			await expect(
				recordRegistrationReviewDelta(db, SEASON, aCreate),
			).resolves.toBe(true);
			await expect(
				recordRegistrationReviewDelta(db, SEASON, aCreate),
			).resolves.toBe(false);
			await expect(
				runRegistrationReviewNightly(db, SEASON, KEY, beforeCommit),
			).resolves.toEqual({ steps: 0, created: 0, mayHaveMore: false });
			const run = (maxSteps?: number) =>
				runRegistrationReviewNightly(
					db,
					SEASON,
					KEY,
					new Date(),
					maxSteps,
				);
			await expect(run(1)).resolves.toEqual({
				steps: 1,
				created: 0,
				mayHaveMore: true,
			});

			const bBefore = await b.get();
			await b.set(source());
			await recordRegistrationReviewDelta(db, SEASON, {
				id: 'b-create',
				before: bBefore,
				after: await b.get(),
			});
			await expect(run()).resolves.toEqual({
				steps: 1,
				created: 1,
				mayHaveMore: false,
			});
			const original = (await cases.get()).docs[0]!;
			expect(original.get('registrations')).toEqual([a.id, b.id]);

			// A retry after its marker was drained must not reopen or rewrite a case.
			await recordRegistrationReviewDelta(db, SEASON, aCreate);
			await expect(run()).resolves.toEqual({
				steps: 1,
				created: 0,
				mayHaveMore: false,
			});
			expect(
				(await original.ref.get()).updateTime?.isEqual(
					original.updateTime,
				),
			).toBe(true);

			const bBeforeCounters = await b.get();
			await b.update({ includedInCounts: new Date() });
			await expect(
				recordRegistrationReviewDelta(db, SEASON, {
					id: 'b-counter',
					before: bBeforeCounters,
					after: await b.get(),
				}),
			).resolves.toBe(false);
			const otherBefore = await otherSeason.get();
			await otherSeason.set(source(undefined, SEASON + 1));
			await expect(
				recordRegistrationReviewDelta(db, SEASON, {
					id: 'other-year',
					before: otherBefore,
					after: await otherSeason.get(),
				}),
			).resolves.toBe(false);
			expect((await pending.get()).empty).toBe(true);

			const cBefore = await c.get();
			await c.set(source());
			await recordRegistrationReviewDelta(db, SEASON, {
				id: 'c-create',
				before: cBefore,
				after: await c.get(),
			});
			await expect(run()).resolves.toEqual({
				steps: 1,
				created: 2,
				mayHaveMore: false,
			});
			expect((await cases.get()).size).toBe(3);
			expect(
				JSON.stringify(
					(await index.get()).docs.map((doc) => doc.data()),
				),
			).not.toMatch(/juniper|fixture|2032-03|80210/i);

			// Cancel before the corresponding change event arrives: a stale index
			// must not create a new case with this shopper.
			const bBeforeCancel = await b.get();
			await b.update({ cancelledOn: new Date() });
			const dBefore = await d.get();
			await d.set(source());
			await recordRegistrationReviewDelta(db, SEASON, {
				id: 'd-create',
				before: dBefore,
				after: await d.get(),
			});
			await expect(run()).resolves.toEqual({
				steps: 1,
				created: 2,
				mayHaveMore: false,
			});
			expect(
				(await cases.get()).docs.some((doc) => {
					const pair = doc.get('registrations') as string[];
					return pair.includes(b.id) && pair.includes(d.id);
				}),
			).toBe(false);

			await recordRegistrationReviewDelta(db, SEASON, {
				id: 'b-cancel',
				before: bBeforeCancel,
				after: await b.get(),
			});
			const cBeforeEdit = await c.get();
			await c.set(source(['Chloe', 'Daphne', 'Louisa']));
			await recordRegistrationReviewDelta(db, SEASON, {
				id: 'c-edit',
				before: cBeforeEdit,
				after: await c.get(),
			});
			await expect(run()).resolves.toEqual({
				steps: 2,
				created: 0,
				mayHaveMore: false,
			});
			expect((await index.doc(b.id).get()).exists).toBe(false);
			expect((await index.doc(c.id).get()).exists).toBe(true);
			expect((await cases.get()).size).toBe(5);
			expect((await pending.get()).empty).toBe(true);
			await expect(run()).resolves.toEqual({
				steps: 0,
				created: 0,
				mayHaveMore: false,
			});
		}, 45_000);

		it('checkpoints a common-name page and resumes until the late candidate is considered', async () => {
			const season = SEASON + 2;
			const regs = db.collection('registrations');
			const review = db
				.collection('registrationReviewSeasons')
				.doc(String(season));
			const cases = review.collection('cases');
			const pending = review.collection('pendingRosters');
			const decoys = Array.from({ length: 41 }, (_, i) =>
				regs.doc('nightly_candidate_' + String(i).padStart(2, '0')),
			);
			const late = regs.doc('nightly_candidate_z');
			const refs = [...decoys, late];
			const before = await db.getAll(...refs);
			const batch = db.batch();
			for (const [i, ref] of decoys.entries())
				batch.set(
					ref,
					source(['Juniper', 'Different' + i, 'Filler' + i], season),
				);
			batch.set(late, source(undefined, season));
			await batch.commit();
			const after = await db.getAll(...refs);
			await Promise.all(
				after.map((snapshot, index) =>
					recordRegistrationReviewDelta(db, season, {
						id: 'seed-' + index,
						before: before[index]!,
						after: snapshot,
					}),
				),
			);
			const run = (maxSteps?: number) =>
				runRegistrationReviewNightly(
					db,
					season,
					KEY,
					new Date(),
					maxSteps,
				);
			const indexed = await run();
			expect(indexed.created).toBe(0);
			expect(indexed.mayHaveMore).toBe(false);

			const newcomer = regs.doc('nightly_paginated_new');
			const old = await newcomer.get();
			await newcomer.set(source(undefined, season));
			await recordRegistrationReviewDelta(db, season, {
				id: 'paginated-new',
				before: old,
				after: await newcomer.get(),
			});
			await expect(run(1)).resolves.toEqual({
				steps: 1,
				created: 0,
				mayHaveMore: true,
			});
			const marker = pending.doc(newcomer.id);
			expect((await marker.get()).get('after')).toBe(decoys[39]!.id);

			const unchangedProjection = await newcomer.get();
			await newcomer.update({ firstName: 'FIXTURE' });
			await recordRegistrationReviewDelta(db, season, {
				id: 'paginated-equivalent-update',
				before: unchangedProjection,
				after: await newcomer.get(),
			});
			expect((await marker.get()).get('after')).toBe(decoys[39]!.id);
			await expect(run()).resolves.toEqual({
				steps: 1,
				created: 1,
				mayHaveMore: false,
			});
			expect(
				(await cases.get()).docs.map((doc) => doc.get('registrations')),
			).toEqual([[late.id, newcomer.id]]);
		}, 65_000);

		it('seeds preexisting submitted records only when explicitly invoked in the demo emulator', async () => {
			const season = SEASON + 4;
			const regs = db.collection('registrations');
			const review = db
				.collection('registrationReviewSeasons')
				.doc(String(season));
			const pending = review.collection('pendingRosters');
			const batch = db.batch();
			const left = regs.doc('nightly_baseline_a');
			const right = regs.doc('nightly_baseline_z');
			batch.create(left, source(undefined, season));
			batch.create(right, source(undefined, season));
			for (let index = 0; index < 49; index++)
				batch.create(regs.doc('nightly_baseline_draft_' + index), {
					programYear: season,
				});
			batch.create(regs.doc('nightly_baseline_cancelled'), {
				...source(undefined, season),
				cancelledOn: SUBMITTED_AT,
			});
			batch.create(
				regs.doc('nightly_baseline_other_year'),
				source(undefined, season + 1),
			);
			await batch.commit();

			const run = () =>
				runRegistrationReviewNightly(db, season, KEY, new Date());
			await expect(run()).resolves.toEqual({
				steps: 0,
				created: 0,
				mayHaveMore: false,
			});
			const wrongApp = initializeApp(
				{ projectId: 'demo-unrelated-project' },
				'baseline-wrong-test',
			);
			try {
				await expect(
					runRegistrationReviewEmulatorBaseline(wrongApp, season),
				).rejects.toThrow('requires its local demo emulator');
			} finally {
				await deleteApp(wrongApp);
			}

			await expect(
				runRegistrationReviewEmulatorBaseline(app, season),
			).resolves.toEqual({ scanned: 50, queued: 1, mayHaveMore: true });
			expect((await pending.get()).docs.map(({ id }) => id)).toEqual([
				left.id,
			]);
			await expect(run()).resolves.toEqual({
				steps: 1,
				created: 0,
				mayHaveMore: false,
			});
			await expect(
				runRegistrationReviewEmulatorBaseline(app, season),
			).resolves.toEqual({ scanned: 2, queued: 1, mayHaveMore: false });
			expect((await pending.get()).docs.map(({ id }) => id)).toEqual([
				right.id,
			]);
			await expect(run()).resolves.toEqual({
				steps: 1,
				created: 1,
				mayHaveMore: false,
			});
			await expect(
				runRegistrationReviewEmulatorBaseline(app, season),
			).resolves.toEqual({ scanned: 0, queued: 0, mayHaveMore: false });
			expect((await pending.get()).empty).toBe(true);
		}, 30_000);
	},
);
