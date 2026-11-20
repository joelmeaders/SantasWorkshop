import type { App } from 'firebase-admin/app';
import {
	FieldPath,
	FieldValue,
	getFirestore,
	Timestamp,
	type DocumentSnapshot,
	type Firestore,
} from 'firebase-admin/firestore';
import { COLLECTION_SCHEMA } from '../models';
import {
	detectRegistrationReviewPairs,
	prepareTransientReviewRegistration,
	type PreparedRegistration,
	type ReviewRegistration,
} from './registration-review';
import {
	getRegistrationReviewSeason,
	makeStoredReviewCase,
} from './registration-review-store';

export const REGISTRATION_REVIEW_NIGHTLY_MAX_STEPS = 1_000;
const BASELINE_PAGES_PER_RUN = 20;
const BASELINE_PAGE_SIZE = 50;
const CANDIDATE_PAGE_SIZE = 40;
const WORK_BUDGET_MS = 300_000;
const TRANSACTION_OPTIONS = { maxAttempts: 3 };

type CandidateIndex = {
	byName: ReadonlyMap<string, readonly PreparedRegistration[]>;
	readTime: Timestamp;
};

type PendingRoster = {
	eventId: string;
	revision?: string;
	after?: string;
};

type NightlyStep = { created: number } | undefined;

const optionalText = (value: unknown): string | undefined =>
	typeof value === 'string' ? value : undefined;

function isoDate(value: unknown): string | undefined {
	if (value instanceof Timestamp) return value.toDate().toISOString();
	if (value instanceof Date && Number.isFinite(value.getTime()))
		return value.toISOString();
	return typeof value === 'string' && Number.isFinite(Date.parse(value))
		? value
		: undefined;
}

/** Only current, submitted online shoppers can become new review candidates. */
function rosterSource(
	snapshot: DocumentSnapshot,
	season: number,
): ReviewRegistration | undefined {
	const row = snapshot.data();
	if (
		!row ||
		row['programYear'] !== season ||
		!isoDate(row['registrationSubmittedOn']) ||
		row['cancelledOn']
	) {
		return undefined;
	}

	const rawChildren: unknown = row['children'];
	const children: ReviewRegistration['children'] = Array.isArray(rawChildren)
		? rawChildren.flatMap((value: unknown) => {
				if (typeof value !== 'object' || !value) return [];
				const child = value as Record<string, unknown>;
				const firstName = optionalText(child['firstName']);
				if (!firstName || child['enabled'] === false) return [];
				return [
					{
						firstName,
						lastName: optionalText(child['lastName']),
						birthDate: isoDate(child['dateOfBirth']),
					},
				];
			})
		: [];

	return {
		id: snapshot.id,
		accountId: snapshot.id,
		season,
		active: true,
		children,
		adultFirstName: optionalText(row['firstName']),
		adultLastName: optionalText(row['lastName']),
		zip: optionalText(row['zipCode']),
	};
}

/**
 * Firestore redelivery is harmless: persist only a dirty reference, then
 * reconcile current data rather than trusting the triggering snapshot's order.
 */
export async function recordRegistrationReviewDelta(
	db: Firestore,
	season: number,
	event: {
		id: string;
		before: DocumentSnapshot;
		after: DocumentSnapshot;
	},
): Promise<boolean> {
	const before = prepareRoster(event.before, season);
	const after = prepareRoster(event.after, season);
	if (JSON.stringify(before) === JSON.stringify(after)) return false;
	const root = getRegistrationReviewSeason(db, season);
	const pending = root.collection('pendingRosters').doc(event.after.id);

	return db.runTransaction(async (transaction) => {
		const previous = (await transaction.get(pending)).data() as
			PendingRoster | undefined;
		// A queued ID is enough. The worker reads the current roster and
		// resumes its cursor only if the matching fields are still unchanged.
		if (previous) return false;
		const eventRevision = event.after.updateTime;
		if (eventRevision) {
			const processed = await transaction.get(
				root.collection('rosterIndex').doc(event.after.id),
			);
			const sourceRevision: unknown = processed.get('sourceUpdateTime');
			if (
				sourceRevision instanceof Timestamp &&
				eventRevision.valueOf() <= sourceRevision.valueOf()
			)
				return false;
		}
		transaction.set(pending, {
			eventId: event.id,
			queuedAt: FieldValue.serverTimestamp(),
		});
		return true;
	}, TRANSACTION_OPTIONS);
}

function prepareRoster(
	snapshot: DocumentSnapshot,
	season: number,
): PreparedRegistration | undefined {
	const source = rosterSource(snapshot, season);
	if (!source) return undefined;
	const registration = prepareTransientReviewRegistration(source);
	return {
		...registration,
		children: [...registration.children].sort((a, b) =>
			Buffer.compare(
				Buffer.from(JSON.stringify(a)),
				Buffer.from(JSON.stringify(b)),
			),
		),
	};
}

async function loadCandidateIndex(
	db: Firestore,
	season: number,
): Promise<CandidateIndex> {
	const population = await db
		.collection(COLLECTION_SCHEMA.registrations)
		.where('programYear', '==', season)
		.select(
			'programYear',
			'registrationSubmittedOn',
			'cancelledOn',
			'children',
			'firstName',
			'lastName',
			'zipCode',
		)
		.get();
	const byName = new Map<string, PreparedRegistration[]>();
	for (const row of population.docs) {
		const registration = prepareRoster(row, season);
		if (!registration) continue;
		for (const first of new Set(
			registration.children.map(({ first }) => first).filter(Boolean),
		)) {
			const candidates = byName.get(first) ?? [];
			candidates.push(registration);
			byName.set(first, candidates);
		}
	}
	return { byName, readTime: population.readTime };
}

function nextCandidatePage(
	index: CandidateIndex,
	registration: PreparedRegistration,
	after: string | undefined,
): PreparedRegistration[] {
	const names = new Map<string, number>();
	for (const child of registration.children) {
		if (child.first)
			names.set(child.first, (names.get(child.first) ?? 0) + 1);
	}
	const candidates = new Map<string, PreparedRegistration>();
	for (const name of names.keys()) {
		for (const candidate of index.byName.get(name) ?? []) {
			if (
				candidate.id === registration.id ||
				(after &&
					Buffer.compare(
						Buffer.from(candidate.id),
						Buffer.from(after),
					) <= 0)
			)
				continue;
			candidates.set(candidate.id, candidate);
		}
	}
	// No pair with fewer than two shared first names can be classified.
	return [...candidates.values()]
		.filter((candidate) => {
			const remaining = new Map(names);
			let overlap = 0;
			for (const { first } of candidate.children) {
				const count = remaining.get(first) ?? 0;
				if (count > 0) {
					if (++overlap >= 2) return true;
					remaining.set(first, count - 1);
				}
			}
			return false;
		})
		.sort((a, b) => Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)))
		.slice(0, CANDIDATE_PAGE_SIZE + 1);
}

async function runNightlyStep(
	db: Firestore,
	season: number,
	index: CandidateIndex,
	cutoff: Timestamp,
	at: string,
): Promise<NightlyStep> {
	const root = getRegistrationReviewSeason(db, season);
	const registrations = db.collection(COLLECTION_SCHEMA.registrations);
	return db.runTransaction(async (transaction) => {
		const [pending] = (
			await transaction.get(
				root
					.collection('pendingRosters')
					.where('queuedAt', '<=', cutoff)
					.orderBy('queuedAt')
					.limit(1),
			)
		).docs;
		if (!pending) return undefined;

		const projectionRef = root.collection('rosterIndex').doc(pending.id);
		const [source, previous] = await transaction.getAll(
			registrations.doc(pending.id),
			projectionRef,
		);
		// A source edited after the population snapshot could only be matched
		// against stale counterparts. Move it past this run's cutoff so the
		// next run sees both new versions before marking either processed.
		if (
			source.updateTime &&
			source.updateTime.valueOf() > index.readTime.valueOf()
		) {
			transaction.update(pending.ref, {
				queuedAt: FieldValue.serverTimestamp(),
			});
			return { created: 0 };
		}
		const registration = prepareRoster(source, season);
		const revision = source.updateTime?.valueOf();
		const processed: unknown = previous.get('sourceUpdateTime');
		if (
			!registration ||
			!revision ||
			(processed instanceof Timestamp && revision <= processed.valueOf())
		) {
			if (!registration && previous.exists)
				transaction.delete(projectionRef);
			transaction.delete(pending.ref);
			return { created: 0 };
		}

		const marker = pending.data() as PendingRoster;
		const after = marker.revision === revision ? marker.after : undefined;
		const candidates = nextCandidatePage(index, registration, after);
		const records = candidates.slice(0, CANDIDATE_PAGE_SIZE);
		const cases = root.collection('cases');
		const proposals = detectRegistrationReviewPairs({
			season,
			changedIds: new Set([pending.id]),
			population: [registration, ...records],
			knownCaseIds: new Set(),
			at,
		});
		// Most candidate rosters share a name but do not classify as matches.
		// Do not spend a case lookup on those non-matches.
		const known = proposals.length
			? await transaction.getAll(
					...proposals.map(({ id }) => cases.doc(id)),
					{ fieldMask: [] },
				)
			: [];
		const newCases = proposals.filter((_, index) => !known[index]?.exists);

		// A candidate could have changed or canceled before its delta was
		// delivered. Reread only new matches from the canonical collection.
		const byId = new Map(
			records.map((row) => [row.id, JSON.stringify(row)]),
		);
		const otherIds = newCases.map((review) =>
			review.registrations.find((id) => id !== pending.id)!,
		);
		const live = otherIds.length
			? await transaction.getAll(
					...otherIds.map((id) => registrations.doc(id)),
				)
			: [];
		const current = new Set(
			live
				.filter(
					(doc) =>
						JSON.stringify(prepareRoster(doc, season)) ===
						byId.get(doc.id),
				)
				.map(({ id }) => id),
		);
		const confirmed = newCases.filter((_, index) =>
			current.has(otherIds[index]),
		);
		for (const review of confirmed)
			transaction.create(
				cases.doc(review.id),
				makeStoredReviewCase(review),
			);

		if (candidates.length > CANDIDATE_PAGE_SIZE) {
			transaction.update(pending.ref, {
				revision,
				after: records.at(-1)!.id,
			});
		} else {
			transaction.set(projectionRef, {
				sourceUpdateTime: source.updateTime,
			});
			transaction.delete(pending.ref);
		}
		return { created: confirmed.length };
	}, TRANSACTION_OPTIONS);
}

/** Only queued revisions initiate comparisons; the population is read once per nonempty run. */
export async function runRegistrationReviewNightly(
	db: Firestore,
	season: number,
	cutoff: Date,
	maxSteps = REGISTRATION_REVIEW_NIGHTLY_MAX_STEPS,
): Promise<{ steps: number; created: number; mayHaveMore: boolean }> {
	const at = cutoff.toISOString();
	const highWater = Timestamp.fromDate(cutoff);
	const deadline = Date.now() + WORK_BUDGET_MS;
	const pending = await getRegistrationReviewSeason(db, season)
		.collection('pendingRosters')
		.where('queuedAt', '<=', highWater)
		.orderBy('queuedAt')
		.limit(1)
		.get();
	if (pending.empty) return { steps: 0, created: 0, mayHaveMore: false };
	const index = await loadCandidateIndex(db, season);
	let steps = 0;
	let created = 0;
	while (steps < maxSteps && Date.now() < deadline) {
		const result = await runNightlyStep(db, season, index, highWater, at);
		if (!result) return { steps, created, mayHaveMore: false };
		steps++;
		created += result.created;
	}
	return { steps, created, mayHaveMore: true };
}

export async function runRegistrationReviewEmulatorBaseline(
	app: App,
	season: number,
): Promise<{ scanned: number; queued: number; mayHaveMore: boolean }> {
	if (
		app.options.projectId !== 'demo-registration-review' ||
		!/^127\.0\.0\.1:\d+$/u.test(
			process.env['FIRESTORE_EMULATOR_HOST'] ?? '',
		)
	) {
		throw new Error(
			'Registration review baseline requires its local demo emulator.',
		);
	}

	return seedRegistrationReviewBaselinePage(getFirestore(app), season);
}

/** Resume a one-time backfill of submitted registrations that predate capture. */
async function seedRegistrationReviewBaselinePage(
	db: Firestore,
	season: number,
	cutoff?: Timestamp,
): Promise<{ scanned: number; queued: number; mayHaveMore: boolean }> {
	const root = getRegistrationReviewSeason(db, season);
	const baseline = root.collection('run').doc('baseline');
	const pending = root.collection('pendingRosters');
	const index = root.collection('rosterIndex');

	return db.runTransaction(async (transaction) => {
		const checkpoint = await transaction.get(baseline);
		if (checkpoint.get('done') === true)
			return { scanned: 0, queued: 0, mayHaveMore: false };

		const query = db
			.collection(COLLECTION_SCHEMA.registrations)
			.where('programYear', '==', season)
			.orderBy(FieldPath.documentId())
			.select('programYear', 'registrationSubmittedOn', 'cancelledOn')
			.limit(BASELINE_PAGE_SIZE);
		const after = checkpoint.get('after') as string | undefined;
		const page = await transaction.get(
			after ? query.startAfter(after) : query,
		);
		const active = page.docs.filter((row) => rosterSource(row, season));
		const existing = active.length
			? await transaction.getAll(
					...active.map(({ id }) => pending.doc(id)),
					...active.map(({ id }) => index.doc(id)),
					{ fieldMask: [] },
				)
			: [];
		let queued = 0;
		for (const [i, { id }] of active.entries()) {
			if (existing[i]?.exists || existing[i + active.length]?.exists)
				continue;
			transaction.create(pending.doc(id), {
				eventId: 'baseline',
				queuedAt: cutoff ?? FieldValue.serverTimestamp(),
			});
			queued++;
		}

		const mayHaveMore = page.size === BASELINE_PAGE_SIZE;
		transaction.set(baseline, {
			done: !mayHaveMore,
			after: page.docs.at(-1)?.id ?? after ?? null,
		});
		return { scanned: page.size, queued, mayHaveMore };
	}, TRANSACTION_OPTIONS);
}

/** Seed existing registrations once, then classify only pending revisions. */
export async function buildNightlyRegistrationReview(
	db: Firestore,
	season: number,
	cutoff: Date,
): Promise<{
	steps: number;
	created: number;
	mayHaveMore: boolean;
	baselineScanned: number;
	baselineQueued: number;
}> {
	const seedDeadline = Date.now() + 20_000;
	const highWater = Timestamp.fromDate(cutoff);
	let baselineScanned = 0;
	let baselineQueued = 0;
	let baselinePending = true;
	for (
		let page = 0;
		page < BASELINE_PAGES_PER_RUN &&
		baselinePending &&
		Date.now() < seedDeadline;
		page++
	) {
		const result = await seedRegistrationReviewBaselinePage(
			db,
			season,
			highWater,
		);
		baselineScanned += result.scanned;
		baselineQueued += result.queued;
		baselinePending = result.mayHaveMore;
	}
	const reviewed = await runRegistrationReviewNightly(db, season, cutoff);
	return {
		...reviewed,
		mayHaveMore: baselinePending || reviewed.mayHaveMore,
		baselineScanned,
		baselineQueued,
	};
}
