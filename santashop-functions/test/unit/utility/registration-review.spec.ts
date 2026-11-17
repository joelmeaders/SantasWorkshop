import { describe, expect, it } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';
import {
	canManageRegistrationReviewToken,
	requireRegistrationReviewAccess,
} from '../../../src/utility/capabilities';
import {
	changeRegistrationReviewStatus,
	detectRegistrationReviewPairs,
	planRegistrationReviewBatch,
	normalizeRegistrationReviewNote,
	prepareReviewRegistration,
	type PreparedRegistration,
	type ReviewRegistration,
	type ReviewStatus,
} from '../../../src/utility/registration-review';

const secret = Buffer.alloc(32, 47);
const at = '2026-11-17T09:00:00Z';
const later = '2026-11-17T16:00:00Z';
const season = 2026;
const sharedNames = ['Ada', 'Ezra', 'Ivy', 'Hope'];
const roster = sharedNames.map((firstName, index) => ({
	firstName,
	birthDate: `2018-03-2${index}`,
	lastName: 'Miller',
}));

function registration(
	id: string,
	overrides: Partial<ReviewRegistration> = {},
): PreparedRegistration {
	return prepareReviewRegistration(
		{
			id,
			accountId: id,
			season,
			active: true,
			children: roster,
			...overrides,
		},
		secret,
	);
}

function detect(a: PreparedRegistration, b: PreparedRegistration) {
	return detectRegistrationReviewPairs({
		season,
		at,
		population: [a, b],
		changedIds: new Set([a.id, b.id]),
		knownCaseIds: new Set(),
	});
}

function newPair() {
	return planRegistrationReviewBatch({
		season,
		at,
		checkpoint: { cursor: 0 },
		changes: [
			{ cursor: 1, registration: registration('miller') },
			{ cursor: 2, registration: registration('rivera') },
		],
		population: [],
		knownCaseIds: new Set(),
	});
}

describe('registration review batch', () => {
	it('recreates the four report tiers on synthetic registrations', () => {
		const base = registration('A', {
			reliableEmail: 'matched@test.invalid',
		});
		const noDates = roster.map((child) => ({
			...child,
			birthDate: undefined,
		}));
		expect(detect(base, registration('B'))[0]?.tier).toBe('strict');
		expect(
			detect(base, registration('B', { children: noDates }))[0]?.tier,
		).toBe('balanced');
		expect(
			detect(
				base,
				registration('B', {
					children: noDates.slice(0, 3),
					reliableEmail: ' MATCHED@test.invalid ',
				}),
			)[0]?.tier,
		).toBe('broader');
		expect(
			detect(base, registration('B', { children: noDates.slice(0, 3) })),
		).toEqual([]);
		const fillers = (prefix: string) =>
			[1, 2, 3, 4].map((index) => ({ firstName: prefix + index }));
		const revisedDates = roster.map((child, index) => ({
			...child,
			firstName: ` ${child.firstName.toUpperCase()} `,
			lastName: 'Rivera',
			birthDate:
				index === 2
					? '2019-01-01'
					: index === 3
						? undefined
						: child.birthDate,
		}));
		const [partial] = detect(
			registration('miller', {
				children: [...roster, ...fillers('A')],
				reliableEmail: 'left@test.invalid',
			}),
			registration('rivera', {
				children: [...revisedDates, ...fillers('B')],
				reliableEmail: 'right@test.invalid',
			}),
		);
		expect(partial).toEqual(
			expect.objectContaining({
				tier: 'partial-roster',
				status: 'new',
				registrations: ['miller', 'rivera'],
				lastActionAt: at,
				history: [{ type: 'flagged', at }],
				evidence: {
					rosterSizes: [8, 8],
					firstNameMatches: 4,
					exactDateMatches: 2,
					fullNameMatches: 0,
					dobConflicts: 1,
					missingDobComparisons: 1,
					reliableContact: false,
					sameAdultName: false,
					sameZip: false,
				},
			}),
		);
		for (const state of [base, partial]) {
			expect(JSON.stringify(state)).not.toMatch(
				/Ada|Ezra|2018-03-21|matched@test.invalid/i,
			);
		}
	});

	it('does not rescan old pairs but can link a new registration to already-flagged records', () => {
		const first = newPair();
		const old = first.newCases[0];
		if (!old) throw new Error('Expected the initial case.');
		const followUp = planRegistrationReviewBatch({
			season,
			at: later,
			checkpoint: first.checkpoint,
			changes: [
				{ cursor: 2, registration: registration('rivera') },
				{ cursor: 3, registration: registration('miller') },
				{ cursor: 4, registration: registration('three') },
			],
			population: first.indexUpdates,
			knownCaseIds: new Set([old.id]),
		});
		expect(followUp.checkpoint.cursor).toBe(4);
		expect(followUp.indexUpdates.map(({ id }) => id)).toEqual([
			'miller',
			'three',
		]);
		expect(
			followUp.newCases.map(({ registrations }) => registrations),
		).toEqual([
			['miller', 'three'],
			['rivera', 'three'],
		]);
		expect(old.history).toEqual([{ type: 'flagged', at }]);
	});

	it('does not treat repeated exact dates, invalid dates, same accounts or inactive records as evidence for a new match', () => {
		const repeated = [
			{ firstName: 'Ada', birthDate: '2018-03-21' },
			{ firstName: 'ADA', birthDate: '2018-03-21' },
			{ firstName: 'Ezra', birthDate: '2019-02-31' },
		];
		expect(
			detect(
				registration('a', { children: repeated }),
				registration('b', { children: repeated }),
			),
		).toEqual([]);
		expect(
			detect(registration('a'), registration('b', { accountId: 'a' })),
		).toEqual([]);
		const result = planRegistrationReviewBatch({
			season,
			at,
			checkpoint: { cursor: 0 },
			changes: [
				{
					cursor: 3,
					registration: registration('other-season', {
						season: 2025,
					}),
				},
				{
					cursor: 5,
					registration: registration('miller', { active: false }),
				},
				{ cursor: 1, registration: registration('miller') },
			],
			population: [registration('rivera')],
			knownCaseIds: new Set(),
		});
		expect(result.checkpoint.cursor).toBe(5);
		expect(result.newCases).toEqual([]);
		expect(result.indexUpdates).toEqual([
			expect.objectContaining({ id: 'miller', active: false }),
		]);
	});

	it('ranks tier first, then exact matches and emits stable IDs on replay', () => {
		const population = [
			registration('balanced', {
				children: roster.map(({ firstName }) => ({ firstName })),
			}),
			registration('lower-exact', { children: roster.slice(0, 3) }),
			registration('higher-exact'),
		];
		const batch = {
			season,
			at,
			checkpoint: { cursor: 0 },
			changes: [{ cursor: 1, registration: registration('changed') }],
			population,
			knownCaseIds: new Set<string>(),
		};
		const result = planRegistrationReviewBatch(batch);
		expect(
			result.newCases.map(({ tier, evidence }) => [
				tier,
				evidence.exactDateMatches,
			]),
		).toEqual([
			['strict', 4],
			['strict', 3],
			['balanced', 0],
		]);
		expect(
			planRegistrationReviewBatch({
				...batch,
				population: [...population].reverse(),
			}),
		).toEqual(result);
		expect(
			planRegistrationReviewBatch({
				...batch,
				checkpoint: result.checkpoint,
			}).newCases,
		).toEqual([]);
	});
});

describe('registration review state and access', () => {
	it('retains resolved cases, preserves audit history and ignores no-op status changes', () => {
		const original = newPair().newCases[0];
		if (!original) throw new Error('Expected the initial case.');
		const statuses: ReviewStatus[] = [
			'pending-shopper-response',
			'hold',
			'resolved',
		];
		const archived = statuses.reduce(
			(review, status) =>
				changeRegistrationReviewStatus(
					review,
					status,
					'reviewer',
					later,
				),
			original,
		);
		expect(archived).toEqual(
			expect.objectContaining({
				status: 'resolved',
				registrations: original.registrations,
				lastActionAt: later,
				history: [
					{ type: 'flagged', at },
					{
						type: 'status-changed',
						at: later,
						actorUid: 'reviewer',
						from: 'new',
						to: 'pending-shopper-response',
					},
					{
						type: 'status-changed',
						at: later,
						actorUid: 'reviewer',
						from: 'pending-shopper-response',
						to: 'hold',
					},
					{
						type: 'status-changed',
						at: later,
						actorUid: 'reviewer',
						from: 'hold',
						to: 'resolved',
					},
				],
			}),
		);
		expect(
			changeRegistrationReviewStatus(
				archived,
				'resolved',
				'reviewer',
				at,
			),
		).toBe(archived);
	});

	it('requires the explicit review role of admins; owners have it by default', () => {
		expect(canManageRegistrationReviewToken(undefined)).toBe(false);
		expect(canManageRegistrationReviewToken({ owner: true })).toBe(true);
		expect(canManageRegistrationReviewToken({ roles: ['admin'] })).toBe(
			false,
		);
		expect(
			canManageRegistrationReviewToken({
				roles: ['admin', 'registration-review'],
			}),
		).toBe(true);
		expect(
			canManageRegistrationReviewToken({
				roles: ['checkin', 'registration-review'],
			}),
		).toBe(false);
		expect(
			canManageRegistrationReviewToken({ owner: 'true', roles: 'admin' }),
		).toBe(false);
		const request = (
			token?: Record<string, unknown>,
		): CallableRequest<unknown> =>
			({
				auth: token && { uid: 'reviewer', token },
			}) as CallableRequest<unknown>;
		expect(() => requireRegistrationReviewAccess(request())).toThrow(
			expect.objectContaining({ code: 'unauthenticated' }),
		);
		expect(() =>
			requireRegistrationReviewAccess(request({ roles: ['admin'] })),
		).toThrow(expect.objectContaining({ code: 'permission-denied' }));
		expect(requireRegistrationReviewAccess(request({ owner: true }))).toBe(
			'reviewer',
		);
	});
});

describe('review note normalization', () => {
	it('canonicalizes pasted line breaks and preserves meaningful text', () => {
		expect(
			normalizeRegistrationReviewNote(
				'  Discussed next steps.\r\nRecheck tomorrow. ',
			),
		).toBe('Discussed next steps.\nRecheck tomorrow.');
		expect(normalizeRegistrationReviewNote('  Holiday plans 🎁 ')).toBe(
			'Holiday plans 🎁',
		);
		expect(normalizeRegistrationReviewNote('a'.repeat(1000))).toBe(
			'a'.repeat(1000),
		);
	});

	it('rejects invalid lengths, placeholders, control characters and nonstrings', () => {
		for (const value of [
			' ',
			'\r\n\t',
			'...',
			'a'.repeat(1001),
			'some\0text',
			123,
			null,
		]) {
			expect(normalizeRegistrationReviewNote(value)).toBeNull();
		}
	});
});
