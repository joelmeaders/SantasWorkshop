import { createRegistrationReviewDenylist } from '../../src/utility/registration-review-denylist';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createCallableRequest } from '../helpers/callable-context';
import {
	detectRegistrationReviewPairs,
	prepareReviewRegistration,
	type PreparedRegistration,
} from '../../src/utility/registration-review';
import {
	getRegistrationReviewSeason,
	makeStoredReviewCase,
} from '../../src/utility/registration-review-store';
import {
	addRegistrationReviewNote,
	getRegistrationReviewCase,
	listRegistrationReviewCases,
	setRegistrationReviewStatus,
} from '../../src/fn/registrationReview';
import { PROGRAM_YEAR } from '../../src/utility/runtime-config';
import {
	getRegistrationReviewEmulatorCase,
	addRegistrationReviewEmulatorNote,
	listRegistrationReviewEmulatorCases,
	runRegistrationReviewEmulatorBatch,
	setRegistrationReviewEmulatorStatus,
} from '../../src/utility/registration-review-emulator';

const PROJECT = 'demo-registration-review';
const AT = '2026-11-17T09:00:00Z';
const LATER = '2026-11-17T16:00:00Z';
const owner = { uid: 'fixture-owner', owner: true };
const reviewer = {
	uid: 'fixture-reviewer',
	roles: ['admin', 'registration-review'],
};
const ordinaryAdmin = { uid: 'fixture-admin', roles: ['admin'] };
let app: ReturnType<typeof initializeApp>;
let db: ReturnType<typeof getFirestore>;

async function postChange(
	season: number,
	cursor: number,
	id: string,
	{ active = true, match = true }: { active?: boolean; match?: boolean } = {},
): Promise<void> {
	const children = ['Ivy', 'Ezra', 'Alba'].map((firstName, index) => ({
		firstName: match ? firstName : firstName + id,
		birthDate: `2018-03-2${index}`,
	}));
	const registration = prepareReviewRegistration(
		{ id, accountId: id, season, children, active },
		Buffer.alloc(32, 47),
	);
	await db
		.collection('registrationReviewEmulator')
		.doc(String(season))
		.collection('preparedChanges')
		.doc(String(cursor))
		.create({ cursor, registration });
}

describe.skipIf(process.env['REGISTRATION_REVIEW_EMULATOR_TEST'] !== 'true')(
	'registration review isolated Firestore integration',
	() => {
		beforeAll(() => {
			if (process.env['FIRESTORE_EMULATOR_HOST'] !== '127.0.0.1:18081') {
				throw new Error(
					'Expected the dedicated localhost review emulator on port 18081.',
				);
			}
			app = initializeApp({ projectId: PROJECT }, PROJECT);
			db = getFirestore(app);
		});

		afterAll(async () => {
			if (app) await deleteApp(app);
		});

		it('resumes a bounded page and links a late registration without duplicating a flagged case', async () => {
			const season = 2026;
			await Promise.all([
				postChange(season, 1, 'fixture_left'),
				postChange(season, 2, 'fixture_Right'),
				...Array.from({ length: 23 }, (_, i) =>
					postChange(season, 3 + i, `unmatched_${i}`, {
						match: false,
					}),
				),
				postChange(season, 26, 'fixture_later'),
				postChange(season + 1, 1, 'fixture_other_year'),
			]);
			await expect(
				runRegistrationReviewEmulatorBatch(app, season, AT),
			).resolves.toEqual({ cursor: 25, created: 1, mayHaveMore: true });
			await expect(
				runRegistrationReviewEmulatorBatch(app, season, LATER),
			).resolves.toEqual({ cursor: 26, created: 2, mayHaveMore: false });
			await expect(
				runRegistrationReviewEmulatorBatch(app, season, LATER),
			).resolves.toEqual({ cursor: 26, created: 0, mayHaveMore: false });
			await postChange(season, 27, 'fixture_Right', { active: false });
			await expect(
				runRegistrationReviewEmulatorBatch(app, season, LATER),
			).resolves.toEqual({ cursor: 27, created: 0, mayHaveMore: false });

			const queue = await listRegistrationReviewEmulatorCases(
				app,
				season,
				createCallableRequest({ limit: 2 }, owner),
			);
			expect(
				queue.cases.map(({ registrations }) => registrations),
			).toEqual([
				['fixture_later', 'fixture_left'],
				['fixture_later', 'fixture_Right'],
			]);
			expect(
				queue.cases.every((summary) => !('history' in summary)),
			).toBe(true);
			expect(queue.nextCursor).toBeTruthy();
			const next = await listRegistrationReviewEmulatorCases(
				app,
				season,
				createCallableRequest(
					{ limit: 2, after: queue.nextCursor ?? undefined },
					reviewer,
				),
			);
			expect(
				next.cases.map(({ registrations }) => registrations),
			).toEqual([['fixture_left', 'fixture_Right']]);
			expect(next.nextCursor).toBeNull();
			const id = next.cases[0]?.id;
			if (!id) throw new Error('Expected the original case.');
			const row = await getRegistrationReviewEmulatorCase(
				app,
				season,
				createCallableRequest({ id }, reviewer),
			);
			expect(row.history).toEqual([{ type: 'flagged', at: AT }]);
			expect(JSON.stringify(row)).not.toMatch(/ivy|ezra|2018-03-/i);
			await expect(
				getRegistrationReviewEmulatorCase(
					app,
					season + 1,
					createCallableRequest({ id }, reviewer),
				),
			).rejects.toMatchObject({ code: 'not-found' });
			await expect(
				runRegistrationReviewEmulatorBatch(app, season + 1, LATER),
			).resolves.toEqual({ cursor: 1, created: 0, mayHaveMore: false });
		});

		it('restricts list/detail/status to reviewers and keeps resolved history available on demand', async () => {
			const season = 2028;
			await postChange(season, 1, 'fixture_one');
			await postChange(season, 2, 'fixture_two');
			await runRegistrationReviewEmulatorBatch(app, season, AT);
			const before = await listRegistrationReviewEmulatorCases(
				app,
				season,
				createCallableRequest({}, owner),
			);
			const id = before.cases[0]?.id;
			if (!id) throw new Error('Expected a case.');
			await expect(
				listRegistrationReviewEmulatorCases(
					app,
					season,
					createCallableRequest({}, ordinaryAdmin),
				),
			).rejects.toMatchObject({ code: 'permission-denied' });
			await expect(
				getRegistrationReviewEmulatorCase(
					app,
					season,
					createCallableRequest({ id }, ordinaryAdmin),
				),
			).rejects.toMatchObject({ code: 'permission-denied' });
			await expect(
				setRegistrationReviewEmulatorStatus(
					app,
					season,
					createCallableRequest(
						{ id, status: 'resolved' },
						ordinaryAdmin,
					),
					LATER,
				),
			).rejects.toMatchObject({ code: 'permission-denied' });

			for (const status of [
				'pending-shopper-response',
				'hold',
				'resolved',
			] as const) {
				await setRegistrationReviewEmulatorStatus(
					app,
					season,
					createCallableRequest({ id, status }, reviewer),
					LATER,
				);
				const { cases } = await listRegistrationReviewEmulatorCases(
					app,
					season,
					createCallableRequest({}, owner),
				);
				expect(cases).toHaveLength(status === 'resolved' ? 0 : 1);
			}
			await setRegistrationReviewEmulatorStatus(
				app,
				season,
				createCallableRequest({ id, status: 'resolved' }, reviewer),
				LATER,
			);
			const resolved = await listRegistrationReviewEmulatorCases(
				app,
				season,
				createCallableRequest({ scope: 'resolved' }, owner),
			);
			expect(resolved.cases).toEqual([
				expect.objectContaining({
					id,
					status: 'resolved',
					lastActionAt: LATER,
				}),
			]);
			const row = await getRegistrationReviewEmulatorCase(
				app,
				season,
				createCallableRequest({ id }, reviewer),
			);
			expect(row.history).toEqual([
				{ type: 'flagged', at: AT },
				{
					type: 'status-changed',
					at: LATER,
					actorUid: reviewer.uid,
					from: 'new',
					to: 'pending-shopper-response',
				},
				{
					type: 'status-changed',
					at: LATER,
					actorUid: reviewer.uid,
					from: 'pending-shopper-response',
					to: 'hold',
				},
				{
					type: 'status-changed',
					at: LATER,
					actorUid: reviewer.uid,
					from: 'hold',
					to: 'resolved',
				},
			]);
		});

		it('serializes overlapping invocations and refuses a non-demo project', async () => {
			const season = 2029;
			await postChange(season, 1, 'fixture_x');
			await postChange(season, 2, 'fixture_y');
			const both = await Promise.all([
				runRegistrationReviewEmulatorBatch(app, season, AT),
				runRegistrationReviewEmulatorBatch(app, season, LATER),
			]);
			expect(both.map(({ created }) => created).sort()).toEqual([0, 1]);
			expect(both.every(({ cursor }) => cursor === 2)).toBe(true);
			const page = await listRegistrationReviewEmulatorCases(
				app,
				season,
				createCallableRequest({}, owner),
			);
			expect(page.cases).toHaveLength(1);

			const wrongApp = initializeApp(
				{ projectId: 'demo-not-registration-review' },
				'wrong-project',
			);
			try {
				await expect(
					runRegistrationReviewEmulatorBatch(wrongApp, season, AT),
				).rejects.toThrow('requires its isolated emulator');
			} finally {
				await deleteApp(wrongApp);
			}
		}, 30_000);

		it('appends private notes only for reviewers, preserves order and ignores exact retries', async () => {
			const season = 2030;
			await postChange(season, 1, 'fixture_first');
			await postChange(season, 2, 'fixture_second');
			await runRegistrationReviewEmulatorBatch(app, season, AT);
			const initial = await listRegistrationReviewEmulatorCases(
				app,
				season,
				createCallableRequest({}, owner),
			);
			const id = initial.cases[0]?.id;
			if (!id) throw new Error('Expected a case.');
			const add = (
				noteId: string,
				text: string,
				actor: typeof reviewer | typeof owner | typeof ordinaryAdmin,
				at = LATER,
			) =>
				addRegistrationReviewEmulatorNote(
					app,
					season,
					createCallableRequest(
						{ id, noteId, text, actorUid: 'untrusted-actor' },
						actor,
					),
					at,
				);
			await expect(
				add('unauthorized', 'Must never save', ordinaryAdmin),
			).rejects.toMatchObject({ code: 'permission-denied' });
			await expect(
				add('blank', ' \t\r\n ', reviewer),
			).rejects.toMatchObject({ code: 'invalid-argument' });
			await expect(
				add('too-long', 'a'.repeat(1001), reviewer),
			).rejects.toMatchObject({ code: 'invalid-argument' });
			await expect(
				add('bad/id', 'Must never save', reviewer),
			).rejects.toMatchObject({ code: 'invalid-argument' });
			await expect(
				addRegistrationReviewEmulatorNote(
					app,
					season + 1,
					createCallableRequest(
						{ id, noteId: 'other-season', text: 'Must never save' },
						owner,
					),
					LATER,
				),
			).rejects.toMatchObject({ code: 'not-found' });

			const first = await add(
				'one',
				'  Waiting for confirmation. ',
				reviewer,
			);
			expect(first.notes).toEqual([
				{
					id: 'one',
					text: 'Waiting for confirmation.',
					actorUid: reviewer.uid,
					at: LATER,
				},
			]);
			await expect(
				add('one', 'Waiting for confirmation.', reviewer, AT),
			).resolves.toEqual(first);
			for (const duplicate of [
				() => add('one', 'Changed text', reviewer),
				() => add('one', 'Waiting for confirmation.', owner),
			]) {
				await expect(duplicate()).rejects.toMatchObject({
					code: 'already-exists',
				});
			}
			const earlier = await add(
				'two',
				'Original call documented.',
				owner,
				AT,
			);
			expect(earlier.notes).toEqual([
				{
					id: 'two',
					text: 'Original call documented.',
					actorUid: owner.uid,
					at: AT,
				},
				{
					id: 'one',
					text: 'Waiting for confirmation.',
					actorUid: reviewer.uid,
					at: LATER,
				},
			]);
			await expect(
				getRegistrationReviewEmulatorCase(
					app,
					season,
					createCallableRequest({ id }, ordinaryAdmin),
				),
			).rejects.toMatchObject({ code: 'permission-denied' });
			await expect(
				getRegistrationReviewEmulatorCase(
					app,
					season,
					createCallableRequest({ id }, owner),
				),
			).resolves.toEqual(earlier);
			expect(earlier.history).toEqual([{ type: 'flagged', at: AT }]);
			await expect(
				listRegistrationReviewEmulatorCases(
					app,
					season,
					createCallableRequest({}, owner),
				),
			).resolves.toEqual(initial);
		});

		it('searches the entire ranked queue before paging among hundreds of cases', async () => {
			const season = 2031;
			const registration = (index: number): string =>
				`fixture_queue_${String(index).padStart(2, '0')}`;
			await Promise.all(
				Array.from({ length: 26 }, (_, index) =>
					postChange(season, index + 1, registration(index)),
				),
			);
			await expect(
				runRegistrationReviewEmulatorBatch(app, season, AT),
			).resolves.toMatchObject({ created: 300, mayHaveMore: true });
			await expect(
				runRegistrationReviewEmulatorBatch(app, season, LATER),
			).resolves.toMatchObject({ created: 25, mayHaveMore: false });

			async function list(
				options: {
					scope?: 'open' | 'resolved' | 'all';
					limit?: number;
					after?: string;
					search?: string;
				} = {},
			) {
				return listRegistrationReviewEmulatorCases(
					app,
					season,
					createCallableRequest(options, reviewer),
				);
			}
			const first = await list({ limit: 100 });
			const second = await list({
				limit: 100,
				after: first.nextCursor ?? undefined,
			});
			const third = await list({
				limit: 100,
				after: second.nextCursor ?? undefined,
			});
			const last = await list({
				limit: 100,
				after: third.nextCursor ?? undefined,
			});
			expect([
				first.cases.length,
				second.cases.length,
				third.cases.length,
				last.cases.length,
			]).toEqual([100, 100, 100, 25]);
			expect(
				new Set(
					[
						...first.cases,
						...second.cases,
						...third.cases,
						...last.cases,
					].map(({ id }) => id),
				).size,
			).toBe(325);
			expect(last.nextCursor).toBeNull();
			const hidden = last.cases.at(-1);
			if (!hidden) throw new Error('Expected a case beyond page one.');
			await expect(
				list({ search: `  ${hidden.id}  `, limit: 1 }),
			).resolves.toEqual({ cases: [hidden], nextCursor: null });
			expect('searchReferences' in hidden).toBe(false);
			await expect(list({ search: '   ', limit: 100 })).resolves.toEqual(
				first,
			);

			const search = registration(25);
			const matched = await list({ search, limit: 12 });
			const matchedSecond = await list({
				search,
				limit: 12,
				after: matched.nextCursor ?? undefined,
			});
			const matchedLast = await list({
				search,
				limit: 12,
				after: matchedSecond.nextCursor ?? undefined,
			});
			const results = [
				...matched.cases,
				...matchedSecond.cases,
				...matchedLast.cases,
			];
			expect([
				matched.cases.length,
				matchedSecond.cases.length,
				matchedLast.cases.length,
			]).toEqual([12, 12, 1]);
			expect(matchedLast.nextCursor).toBeNull();
			expect(results.map(({ id }) => id)).toEqual(
				[...first.cases, ...second.cases, ...third.cases, ...last.cases]
					.filter(({ registrations }) =>
						registrations.includes(search),
					)
					.map(({ id }) => id),
			);
			await expect(list({ search: 'fixture_queue_2' })).resolves.toEqual({
				cases: [],
				nextCursor: null,
			});
			await expect(
				list({ search: search.toUpperCase() }),
			).resolves.toEqual({ cases: [], nextCursor: null });
			await expect(
				list({ search, after: first.nextCursor ?? undefined }),
			).rejects.toMatchObject({ code: 'invalid-argument' });

			await setRegistrationReviewEmulatorStatus(
				app,
				season,
				createCallableRequest(
					{ id: hidden.id, status: 'resolved' },
					reviewer,
				),
				LATER,
			);
			await expect(list({ search: hidden.id })).resolves.toEqual({
				cases: [],
				nextCursor: null,
			});
			for (const scope of ['resolved', 'all'] as const) {
				await expect(
					list({ scope, search: hidden.id }),
				).resolves.toEqual({
					cases: [
						{ ...hidden, status: 'resolved', lastActionAt: LATER },
					],
					nextCursor: null,
				});
			}
			for (const invalid of [
				'fixture/queue/25',
				'sample@',
				'a'.repeat(81),
				'<XSS>',
			]) {
				await expect(list({ search: invalid })).rejects.toMatchObject({
					code: 'invalid-argument',
				});
			}
			await expect(
				listRegistrationReviewEmulatorCases(
					app,
					season,
					createCallableRequest({ search }, ordinaryAdmin),
				),
			).rejects.toMatchObject({ code: 'permission-denied' });
		}, 30_000);

		it('matches current adult email on both sides, including canceled registrations without an active search index', async () => {
			const season = 2032;
			const active = 'email_fixture_active';
			const canceled = 'email_fixture_canceled';
			const outside = 'email_fixture_other_season';
			const changed = 'email_fixture_changed';
			const email = 'review-family@example.invalid';
			const oldEmail = 'old-review-family@example.invalid';
			const refs = [active, canceled, outside, changed];
			await Promise.all(
				refs.map((id, index) => postChange(season, index + 1, id)),
			);

			// Match the canonical shape after normal submission/account updates or cancellation.
			const registrations = db.collection('registrations');
			await Promise.all([
				registrations.doc(active).set({
					programYear: season,
					emailAddress: email,
					registrationSubmittedOn: new Date(AT),
				}),
				registrations.doc(canceled).set({
					programYear: season,
					emailAddress: email,
					cancelledOn: new Date(AT),
				}),
				registrations
					.doc(outside)
					.set({ programYear: season - 1, emailAddress: email }),
				registrations.doc(changed).set({
					programYear: season,
					emailAddress: 'new-address@example.invalid',
				}),
				db
					.collection('registrationsearchindex')
					.doc(changed)
					.set({ emailAddress: oldEmail }),
			]);
			await runRegistrationReviewEmulatorBatch(app, season, AT);

			async function list(
				options: {
					scope?: 'open' | 'resolved' | 'all';
					limit?: number;
					after?: string;
					search?: string;
				} = {},
			) {
				return listRegistrationReviewEmulatorCases(
					app,
					season,
					createCallableRequest(options, reviewer),
				);
			}
			const all = (await list()).cases;
			const expected = all.filter(
				({ registrations: ids }) =>
					ids.includes(active) || ids.includes(canceled),
			);
			expect(expected).toHaveLength(5);
			const first = await list({
				search: `  ${email.toUpperCase()}  `,
				limit: 2,
			});
			const second = await list({
				search: email,
				limit: 2,
				after: first.nextCursor ?? undefined,
			});
			const third = await list({
				search: email,
				limit: 2,
				after: second.nextCursor ?? undefined,
			});
			expect([
				first.cases.length,
				second.cases.length,
				third.cases.length,
			]).toEqual([2, 2, 1]);
			expect(third.nextCursor).toBeNull();
			expect([...first.cases, ...second.cases, ...third.cases]).toEqual(
				expected,
			);
			expect(JSON.stringify([first, second, third])).not.toContain('@');
			await expect(list({ search: oldEmail })).resolves.toEqual({
				cases: [],
				nextCursor: null,
			});
			await expect(
				list({ search: 'review-family@example' }),
			).rejects.toMatchObject({ code: 'invalid-argument' });
			await expect(
				listRegistrationReviewEmulatorCases(
					app,
					season,
					createCallableRequest({ search: email }, ordinaryAdmin),
				),
			).rejects.toMatchObject({ code: 'permission-denied' });

			const onlyCanceled = expected.find(
				({ registrations: ids }) =>
					ids.includes(canceled) && !ids.includes(active),
			);
			if (!onlyCanceled)
				throw new Error('Expected a canceled-side-only result.');
			await setRegistrationReviewEmulatorStatus(
				app,
				season,
				createCallableRequest(
					{ id: onlyCanceled.id, status: 'resolved' },
					owner,
				),
				LATER,
			);
			expect(
				(await list({ search: email })).cases.map(({ id }) => id),
			).toEqual(
				expected
					.filter(({ id }) => id !== onlyCanceled.id)
					.map(({ id }) => id),
			);
			expect(
				(await list({ search: email, scope: 'resolved' })).cases,
			).toEqual([
				{ ...onlyCanceled, status: 'resolved', lastActionAt: LATER },
			]);

			const excessEmail = 'too-many-fixtures@example.invalid';
			await Promise.all(
				Array.from({ length: 21 }, (_, index) =>
					registrations.doc(`email_fixture_excess_${index}`).set({
						programYear: season,
						emailAddress: excessEmail,
					}),
				),
			);
			await expect(list({ search: excessEmail })).rejects.toMatchObject({
				code: 'resource-exhausted',
				message:
					'Too many registrations share that email. Search for a registration or case reference instead.',
			});
		}, 30_000);

		it('gates actual review handlers and returns only linked current-season registration detail', async () => {
			const season = PROGRAM_YEAR;
			const uidA = 'callable-fixture-morgan';
			const uidB = 'callable-fixture-other';
			const prepare = (id: string): PreparedRegistration =>
				prepareReviewRegistration(
					{
						id,
						accountId: id,
						season,
						active: true,
						children: ['Ari', 'Jules', 'Ren'].map((firstName) => ({
							firstName,
							birthDate: '2018-11-05',
						})),
					},
					Buffer.alloc(32, 63),
				);
			const [review] = detectRegistrationReviewPairs({
				season,
				population: [prepare(uidA), prepare(uidB)],
				changedIds: new Set([uidA, uidB]),
				knownCaseIds: new Set(),
				at: AT,
			});
			if (!review) throw new Error('Expected a seeded case.');
			const root = getRegistrationReviewSeason(db, season);
			const registration = db.collection('registrations').doc(uidA);
			await Promise.all([
				root
					.collection('cases')
					.doc(review.id)
					.create(makeStoredReviewCase(review)),
				registration.set({
					programYear: season,
					firstName: 'Morgan',
					lastName: 'Test',
					emailAddress: 'morgan@example.invalid',
					zipCode: '80200',
					registrationSubmittedOn: new Date(AT),
					dateTimeSlot: {
						id: 'fixture-slot',
						dateTime: new Date(LATER),
					},
					qrcode: 'private-fixture-qr-code',
					qrCodeStoragePath: 'private-fixture-storage-path',
					children: [
						{
							firstName: 'Aria',
							lastName: 'Test',
							dateOfBirth: new Date('2018-11-05'),
							enabled: true,
							toyType: 'girls',
						},
					],
					privateValue: 'fixture-private-never-returned',
				}),
				db.collection('users').doc(uidA).set({}),
				db
					.collection('shopperAccess')
					.doc(uidA)
					.set({ disabled: true }),
				db
					.collection('registrations')
					.doc(uidB)
					.set({
						programYear: season - 1,
						emailAddress: 'morgan.old@example.invalid',
					}),
				registration
					.collection('review')
					.doc('roster')
					.set({
						children: [
							{
								firstName: 'Removed',
								lastName: 'Test',
								enabled: true,
							},
						],
					}),
			]);
			const req = createCallableRequest({ id: review.id }, reviewer);
			try {
				vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
				vi.stubEnv('GCLOUD_PROJECT', PROJECT);
				vi.stubEnv('SANTASHOP_REGISTRATION_REVIEW_ENABLED', 'false');
				await expect(
					getRegistrationReviewCase(req, app),
				).rejects.toMatchObject({ code: 'failed-precondition' });
				vi.stubEnv('SANTASHOP_REGISTRATION_REVIEW_ENABLED', 'true');
				vi.stubEnv('GCLOUD_PROJECT', 'santas-workshop-test');
				await expect(
					getRegistrationReviewCase(req, app),
				).rejects.toMatchObject({ code: 'failed-precondition' });
				vi.stubEnv('GCLOUD_PROJECT', PROJECT);
				await expect(
					getRegistrationReviewCase(
						createCallableRequest({ id: review.id }, ordinaryAdmin),
						app,
					),
				).rejects.toMatchObject({ code: 'permission-denied' });
				await expect(
					listRegistrationReviewCases(
						{ ...createCallableRequest({}), auth: undefined },
						app,
					),
				).rejects.toMatchObject({ code: 'unauthenticated' });

				for (const term of ['Morg', '  morgan@ ']) {
					const result = await listRegistrationReviewCases(
						createCallableRequest(
							{ search: term, searchMode: 'email-prefix' },
							reviewer,
						),
						app,
					);
					expect(result.cases.map(({ id }) => id)).toEqual([
						review.id,
					]);
					expect(JSON.stringify(result)).not.toContain(
						'morgan@example.invalid',
					);
				}
				for (const term of ['mo', '@example.invalid']) {
					await expect(
						listRegistrationReviewCases(
							createCallableRequest(
								{ search: term, searchMode: 'email-prefix' },
								reviewer,
							),
							app,
						),
					).rejects.toMatchObject({ code: 'invalid-argument' });
				}
				await expect(
					listRegistrationReviewCases(
						createCallableRequest(
							{ search: 'gan', searchMode: 'email-prefix' },
							reviewer,
						),
						app,
					),
				).resolves.toEqual({ cases: [], nextCursor: null });

				const detail = await getRegistrationReviewCase(req, app);
				expect(detail.registrationDetails[0]).toMatchObject({
					id: uidA,
					name: 'Morgan Test',
					email: 'morgan@example.invalid',
					appointment: new Date(LATER).toISOString(),
					expectedRevision: expect.stringMatching(/^\d+:\d+$/u),
					accessDisabled: true,
					availableActions: [
						'contact',
						'enable',
						'cancel',
						'editChild',
						'removeChild',
						'restoreChild',
					],
					children: [
						{
							childIndex: 0,
							name: 'Aria Test',
							birthDate: '2018-11-05',
							removed: false,
						},
						{ childIndex: 0, name: 'Removed Test', removed: true },
					],
				});
				expect(detail.registrationDetails[1]).toBeNull();
				expect(JSON.stringify(detail)).not.toMatch(
					/fixture-private|private-fixture-qr|morgan\.old/u,
				);

				const status = await setRegistrationReviewStatus(
					createCallableRequest(
						{ id: review.id, status: 'hold' },
						reviewer,
					),
					app,
				);
				expect(status.status).toBe('hold');
				const noteInput = {
					id: review.id,
					noteId: 'case-note',
					text: 'Synthetic note for this case.',
				};
				const note = await addRegistrationReviewNote(
					createCallableRequest(noteInput, owner),
					app,
				);
				expect(note.notes).toEqual([
					expect.objectContaining({
						id: noteInput.noteId,
						text: noteInput.text,
						actorUid: owner.uid,
					}),
				]);
				await expect(
					addRegistrationReviewNote(
						createCallableRequest(noteInput, owner),
						app,
					),
				).resolves.toEqual(note);

				const key = Buffer.alloc(32, 93);
				const cancellationId = 'projection-fixture-cancellation';
				vi.stubEnv(
					'SANTASHOP_REGISTRATION_REVIEW_DENYLIST_ENABLED',
					'true',
				);
				vi.stubEnv(
					'SANTASHOP_REGISTRATION_REVIEW_DENYLIST_HMAC_KEY',
					key.toString('base64'),
				);
				await registration.update({
					cancelledOn: new Date(),
					cancellationLogId: cancellationId,
					registrationSubmittedOn: null,
				});
				const ownerRequest = createCallableRequest(
					{ id: review.id },
					owner,
				);
				expect(
					(await getRegistrationReviewCase(ownerRequest, app))
						.registrationDetails[0]?.availableActions,
				).toContain('blacklist');
				const policy = createRegistrationReviewDenylist(db, key);
				const binding = {
					email: 'morgan@example.invalid',
					shopperUid: uidA,
					actorUid: owner.uid,
					caseId: review.id,
					cancellationId,
					reason: 'Synthetic block visibility',
				};
				await db.runTransaction((tx) =>
					policy.apply(tx, {
						...binding,
						kind: 'block',
						operationId: 'visibility-fixture-block',
					}),
				);
				const operation = db.doc(
					'registrationReviewAuthOperations/' + uidA,
				);
				for (const [state, ownerAction] of [
					['applying', undefined],
					['failed', 'blacklist'],
					['confirmed', 'unblacklist'],
				] as const) {
					await operation.set({
						caseId: review.id,
						cancellationId,
						state,
					});
					const reviewerRecord = (
						await getRegistrationReviewCase(req, app)
					).registrationDetails[0];
					const ownerRecord = (
						await getRegistrationReviewCase(ownerRequest, app)
					).registrationDetails[0];
					expect(reviewerRecord).toMatchObject({
						blacklisted: true,
						blockOperationPhase: state,
					});
					expect(reviewerRecord?.availableActions).not.toEqual(
						expect.arrayContaining(['reinstate']),
					);
					expect(reviewerRecord?.availableActions).not.toContain(
						'blacklist',
					);
					expect(reviewerRecord?.availableActions).not.toContain(
						'unblacklist',
					);
					if (ownerAction)
						expect(ownerRecord?.availableActions).toContain(
							ownerAction,
						);
					else {
						expect(ownerRecord?.availableActions).not.toContain(
							'blacklist',
						);
						expect(ownerRecord?.availableActions).not.toContain(
							'unblacklist',
						);
					}
				}
				await db.runTransaction((tx) =>
					policy.apply(tx, {
						...binding,
						kind: 'unblock',
						operationId: 'visibility-fixture-unblock',
					}),
				);
				await operation.update({ state: 'cleared' });
				expect(
					(await getRegistrationReviewCase(ownerRequest, app))
						.registrationDetails[0],
				).toMatchObject({
					blacklisted: false,
					blockOperationPhase: 'cleared',
				});
			} finally {
				vi.unstubAllEnvs();
			}
		});
	},
);
