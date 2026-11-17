import { createHash, createHmac } from 'node:crypto';

type ChildIdentity = {
	firstName: string;
	lastName?: string;
	birthDate?: string;
};

export type ReviewRegistration = {
	id: string;
	accountId: string;
	season: number;
	active: boolean;
	children: readonly ChildIdentity[];
	adultFirstName?: string;
	adultLastName?: string;
	zip?: string;
	// From verified Auth join; omit when unavailable or sources disagree.
	reliableEmail?: string;
};

type PreparedChild = { first: string; last: string; dob: string };

export type PreparedRegistration = Pick<
	ReviewRegistration,
	'id' | 'accountId' | 'active' | 'season'
> & {
	children: readonly PreparedChild[];
	adult: string;
	email: string;
	zip: string;
};

export const reviewTiers = [
	'strict',
	'balanced',
	'broader',
	'partial-roster',
] as const;
type ReviewTier = (typeof reviewTiers)[number];

type MatchEvidence = {
	firstNameMatches: number;
	exactDateMatches: number;
	fullNameMatches: number;
	dobConflicts: number;
	missingDobComparisons: number;
	sameAdultName: boolean;
	reliableContact: boolean;
	sameZip: boolean;
	rosterSizes: readonly [number, number];
};

export type ReviewStatus =
	'new' | 'pending-shopper-response' | 'hold' | 'resolved';

type ReviewEvent =
	| { type: 'flagged'; at: string }
	| {
			type: 'action-taken';
			at: string;
			actorUid: string;
			action: string;
			registrationId: string;
	  }
	| {
			type: 'status-changed';
			at: string;
			actorUid: string;
			from: ReviewStatus;
			to: ReviewStatus;
	  };

export type ReviewCase = {
	id: string;
	season: number;
	registrations: readonly [string, string];
	tier: ReviewTier;
	evidence: MatchEvidence;
	status: ReviewStatus;
	lastActionAt: string;
	history: readonly ReviewEvent[];
};

export const REGISTRATION_REVIEW_NOTE_MAX_LENGTH = 1000;

export type ReviewNote = {
	id: string;
	text: string;
	actorUid: string;
	at: string;
};

export function normalizeRegistrationReviewNote(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const text = value.replace(/\r\n?/gu, '\n').trim();
	return text.length <= REGISTRATION_REVIEW_NOTE_MAX_LENGTH &&
		/[\p{L}\p{N}\p{S}]/u.test(text) &&
		!/(?![\n\t])\p{Cc}/u.test(text)
		? text
		: null;
}

export type ReviewCheckpoint = {
	// This cursor is a job-source cursor, not a client timestamp.
	cursor: number;
};

const name = (value = ''): string =>
	value.normalize('NFC').toLowerCase().trim().replace(/\s+/gu, ' ');

export function prepareReviewRegistration(
	{
		id,
		accountId,
		active,
		season,
		children,
		adultFirstName,
		adultLastName,
		zip,
		reliableEmail,
	}: ReviewRegistration,
	secret: Buffer,
): PreparedRegistration {
	const sign = (field: string, ...values: string[]): string =>
		values.every(Boolean)
			? createHmac('sha256', secret)
					.update(JSON.stringify([season, field, ...values]))
					.digest('hex')
			: '';
	return {
		id,
		accountId,
		season,
		active,
		children: active
			? children.map(({ firstName, lastName, birthDate }) => ({
					first: sign('child-first', name(firstName)),
					last: sign('child-last', name(lastName)),
					dob: sign('child-dob', dobKey(birthDate)),
				}))
			: [],
		adult: active
			? sign('adult-name', name(adultFirstName), name(adultLastName))
			: '',
		email: active
			? sign('verified-email', reliableEmail?.trim().toLowerCase() ?? '')
			: '',
		zip: active ? sign('zip', zip?.match(/^\d{5}/u)?.[0] ?? '') : '',
	};
}

function dobKey(value = ''): string {
	if (
		!/^\d{4}-\d{2}-\d{2}(?:$|T)/u.test(value) ||
		!Number.isFinite(Date.parse(value))
	)
		return '';
	const key = value.slice(0, 10);
	const date = new Date(`${key}T00:00:00.000Z`);
	return date.toISOString().slice(0, 10) === key ? key : '';
}

function rosterByFirst(
	children: readonly PreparedChild[],
): Map<string, PreparedChild[]> {
	const names = new Map<string, PreparedChild[]>();
	for (const child of children) {
		if (!child.first) continue;
		const group = names.get(child.first) ?? [];
		group.push(child);
		names.set(child.first, group);
	}
	return names;
}

function intersection(
	left: readonly string[],
	right: readonly string[],
): number {
	const counts = new Map<string, number>();
	for (const value of left) {
		if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	let matches = 0;
	for (const value of right) {
		const available = counts.get(value) ?? 0;
		if (available === 0) continue;
		counts.set(value, available - 1);
		matches++;
	}
	return matches;
}

function compare(
	left: PreparedRegistration,
	right: PreparedRegistration,
	leftNames: ReadonlyMap<string, PreparedChild[]>,
	rightNames: ReadonlyMap<string, PreparedChild[]>,
): MatchEvidence {
	let firstNameMatches = 0;
	let exactDateMatches = 0;
	let fullNameMatches = 0;
	let dobConflicts = 0;
	let missingDobComparisons = 0;
	for (const [first, leftGroup] of leftNames) {
		const rightGroup = rightNames.get(first);
		if (!rightGroup) continue;
		const names = Math.min(leftGroup.length, rightGroup.length);
		const leftDates = leftGroup.map((child) => child.dob).filter(Boolean);
		const rightDates = rightGroup.map((child) => child.dob).filter(Boolean);
		// Repeated name/DOB rows cannot create an additional exact match.
		const dates = intersection(
			[...new Set(leftDates)],
			[...new Set(rightDates)],
		);
		const availableDates = Math.min(leftDates.length, rightDates.length);
		firstNameMatches += names;
		exactDateMatches += dates;
		fullNameMatches += intersection(
			leftGroup.map((child) => child.last),
			rightGroup.map((child) => child.last),
		);
		dobConflicts += availableDates - intersection(leftDates, rightDates);
		missingDobComparisons += names - availableDates;
	}

	return {
		firstNameMatches,
		exactDateMatches,
		fullNameMatches,
		dobConflicts,
		missingDobComparisons,
		rosterSizes: [left.children.length, right.children.length],
		sameAdultName: Boolean(left.adult && left.adult === right.adult),
		reliableContact: Boolean(left.email && left.email === right.email),
		sameZip: Boolean(left.zip && left.zip === right.zip),
	};
}

function selectTier(evidence: MatchEvidence): ReviewTier | null {
	const {
		rosterSizes,
		firstNameMatches,
		exactDateMatches,
		reliableContact,
		sameAdultName,
	} = evidence;
	const smallerRoster = Math.min(...rosterSizes);
	const exactFraction = exactDateMatches / smallerRoster;
	const firstNameFraction = firstNameMatches / smallerRoster;
	if (
		exactFraction >= 0.75 &&
		(exactDateMatches >= 3 ||
			(exactDateMatches >= 2 && (reliableContact || sameAdultName)))
	)
		return 'strict';
	if (firstNameMatches >= 4 && firstNameFraction >= 0.75) return 'balanced';
	if (firstNameMatches >= 3 && firstNameFraction >= 0.75 && reliableContact)
		return 'broader';
	if (
		firstNameMatches >= 4 &&
		firstNameMatches / Math.max(...rosterSizes) >= 0.5 &&
		exactDateMatches >= 2
	)
		return 'partial-roster';
	return null;
}

export function compareReviewPriority(
	left: ReviewCase,
	right: ReviewCase,
): number {
	return (
		reviewTiers.indexOf(left.tier) - reviewTiers.indexOf(right.tier) ||
		right.evidence.exactDateMatches - left.evidence.exactDateMatches ||
		right.evidence.firstNameMatches - left.evidence.firstNameMatches ||
		right.evidence.firstNameMatches /
			Math.max(...right.evidence.rosterSizes) -
			left.evidence.firstNameMatches /
				Math.max(...left.evidence.rosterSizes) ||
		left.registrations[0].localeCompare(right.registrations[0], 'en') ||
		left.registrations[1].localeCompare(right.registrations[1], 'en')
	);
}

function pairId(
	season: number,
	registrations: readonly [string, string],
): string {
	return createHash('sha256')
		.update(JSON.stringify([season, ...registrations]))
		.digest('hex');
}

function orderedPair(left: string, right: string): [string, string] {
	return left.localeCompare(right, 'en') < 0 ? [left, right] : [right, left];
}

/** Compute a case reference without comparing or exposing roster evidence. */
export function registrationReviewCaseId(
	season: number,
	left: string,
	right: string,
): string {
	return pairId(season, orderedPair(left, right));
}

// Only changed records drive matching. Already flagged families stay in the
// compact index so a genuinely new registration can still match their roster.
export function detectRegistrationReviewPairs({
	season,
	changedIds,
	population,
	knownCaseIds,
	at,
}: {
	season: number;
	changedIds: ReadonlySet<string>;
	population: readonly PreparedRegistration[];
	knownCaseIds: ReadonlySet<string>;
	at: string;
}): ReviewCase[] {
	if (changedIds.size === 0) return [];
	const byFirst = new Map<string, PreparedRegistration[]>();
	const active = population.filter((r) => r.active && r.season === season);
	const rosters = new Map(
		active.map((r) => [r.id, rosterByFirst(r.children)]),
	);
	for (const registration of active) {
		for (const first of rosters.get(registration.id)?.keys() ?? []) {
			const matches = byFirst.get(first) ?? [];
			matches.push(registration);
			byFirst.set(first, matches);
		}
	}

	const cases: ReviewCase[] = [];
	for (const changed of active) {
		if (!changedIds.has(changed.id)) continue;
		const names = rosters.get(changed.id) ?? new Map();
		const candidates = new Map<PreparedRegistration, number>();
		for (const [first, leftGroup] of names) {
			for (const other of byFirst.get(first) ?? []) {
				if (
					other.id === changed.id ||
					other.accountId === changed.accountId ||
					(changedIds.has(other.id) && other.id < changed.id)
				)
					continue;
				const rightGroup = rosters.get(other.id)?.get(first);
				if (!rightGroup) continue;
				candidates.set(
					other,
					(candidates.get(other) ?? 0) +
						Math.min(leftGroup.length, rightGroup.length),
				);
			}
		}
		for (const [other, possible] of candidates) {
			if (possible < 2) continue;
			const registrations = orderedPair(changed.id, other.id);
			const id = pairId(season, registrations);
			if (knownCaseIds.has(id)) continue;
			const [left, right] =
				registrations[0] === changed.id
					? [changed, other]
					: [other, changed];
			const evidence = compare(
				left,
				right,
				rosters.get(left.id) ?? new Map(),
				rosters.get(right.id) ?? new Map(),
			);
			const tier = selectTier(evidence);
			if (!tier) continue;
			cases.push({
				id,
				season,
				registrations,
				tier,
				evidence,
				status: 'new',
				lastActionAt: at,
				history: [{ type: 'flagged', at }],
			});
		}
	}
	return cases.sort(compareReviewPriority);
}

// Build the next checkpoint and compact index updates. The storage adapter
// commits them only after all returned cases have been created idempotently.
export function planRegistrationReviewBatch({
	season,
	checkpoint,
	changes,
	population,
	knownCaseIds,
	at,
}: {
	season: number;
	checkpoint: ReviewCheckpoint;
	changes: readonly { cursor: number; registration: PreparedRegistration }[];
	population: readonly PreparedRegistration[];
	knownCaseIds: ReadonlySet<string>;
	at: string;
}): {
	checkpoint: ReviewCheckpoint;
	indexUpdates: PreparedRegistration[];
	newCases: ReviewCase[];
} {
	const updates = new Map<string, (typeof changes)[number]>();
	let cursor = checkpoint.cursor;
	for (const change of changes) {
		if (change.cursor <= checkpoint.cursor) continue;
		cursor = Math.max(cursor, change.cursor);
		if (change.registration.season !== season) continue;
		const previous = updates.get(change.registration.id);
		if (!previous || change.cursor > previous.cursor)
			updates.set(change.registration.id, change);
	}
	const indexUpdates = [...updates.values()].map(
		({ registration }) => registration,
	);
	const nextPopulation = [
		...population.filter((r) => r.season === season && !updates.has(r.id)),
		...indexUpdates,
	];
	return {
		checkpoint: { cursor },
		indexUpdates,
		newCases: detectRegistrationReviewPairs({
			season,
			population: nextPopulation,
			knownCaseIds,
			changedIds: new Set(updates.keys()),
			at,
		}),
	};
}

export function changeRegistrationReviewStatus(
	review: ReviewCase,
	status: ReviewStatus,
	actorUid: string,
	at: string,
): ReviewCase {
	if (status === review.status) return review;
	return {
		...review,
		status,
		lastActionAt: at,
		history: [
			...review.history,
			{
				type: 'status-changed',
				at,
				actorUid,
				from: review.status,
				to: status,
			},
		],
	};
}
