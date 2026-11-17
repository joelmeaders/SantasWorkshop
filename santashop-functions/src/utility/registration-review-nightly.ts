import { createHash } from 'node:crypto';
import type { App } from 'firebase-admin/app';
import {
	FieldPath,
	FieldValue,
	getFirestore,
	Timestamp,
	type DocumentSnapshot,
	type Firestore,
	type QueryDocumentSnapshot,
	type Transaction,
} from 'firebase-admin/firestore';
import { COLLECTION_SCHEMA } from '../models';
import {
	detectRegistrationReviewPairs,
	prepareReviewRegistration,
	registrationReviewCaseId,
	type PreparedRegistration,
	type ReviewRegistration,
} from './registration-review';
import {
	getRegistrationReviewSeason,
	makeStoredReviewCase,
} from './registration-review-store';

export const REGISTRATION_REVIEW_NIGHTLY_MAX_STEPS = 250;
const CANDIDATE_PAGE_SIZE = 40;
const MAX_KEYS_PER_QUERY = 30;
const WORK_BUDGET_MS = 120_000;
const TRANSACTION_OPTIONS = { maxAttempts: 3 };

type IndexedRoster = {
	registration: PreparedRegistration;
	revision: string;
	firstNameKeys: string[];
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
	const before = rosterSource(event.before, season);
	const after = rosterSource(event.after, season);
	if (JSON.stringify(before) === JSON.stringify(after)) return false;
	const pending = getRegistrationReviewSeason(db, season)
		.collection('pendingRosters')
		.doc(event.after.id);

	return db.runTransaction(async (transaction) => {
		const previous = (await transaction.get(pending)).data() as
			PendingRoster | undefined;
		if (previous?.eventId === event.id) return false;
		if (previous) {
			// Keep the original queue position and a cursor that still matches
			// the current projection; the worker resets it if the roster changed.
			transaction.update(pending, { eventId: event.id });
			return true;
		}
		transaction.set(pending, {
			eventId: event.id,
			queuedAt: FieldValue.serverTimestamp(),
		});
		return true;
	}, TRANSACTION_OPTIONS);
}

function prepareIndexedRoster(
	snapshot: DocumentSnapshot,
	season: number,
	key: Buffer,
): IndexedRoster | undefined {
	const source = rosterSource(snapshot, season);
	if (!source) return undefined;

	const prepared = prepareReviewRegistration(source, key);
	// A reorder-only or case-only source edit need not compare the roster again.
	const children = [...prepared.children].sort(
		(a, b) =>
			a.first.localeCompare(b.first) ||
			a.last.localeCompare(b.last) ||
			a.dob.localeCompare(b.dob),
	);
	const registration = { ...prepared, children };
	return {
		registration,
		revision: createHash('sha256')
			.update(JSON.stringify(registration))
			.digest('hex'),
		firstNameKeys: [
			...new Set(children.map(({ first }) => first).filter(Boolean)),
		],
	};
}

async function nextCandidatePage(
	transaction: Transaction,
	db: Firestore,
	season: number,
	firstNameKeys: string[],
	after: string | undefined,
): Promise<QueryDocumentSnapshot[]> {
	const candidates = getRegistrationReviewSeason(db, season).collection(
		'rosterIndex',
	);
	const queries = [];
	for (
		let start = 0;
		start < firstNameKeys.length;
		start += MAX_KEYS_PER_QUERY
	) {
		const query = candidates
			.where(
				'firstNameKeys',
				'array-contains-any',
				firstNameKeys.slice(start, start + MAX_KEYS_PER_QUERY),
			)
			.orderBy(FieldPath.documentId())
			.limit(CANDIDATE_PAGE_SIZE + 1);
		queries.push(transaction.get(after ? query.startAfter(after) : query));
	}

	const unique = new Map<string, QueryDocumentSnapshot>();
	for (const result of await Promise.all(queries))
		for (const candidate of result.docs)
			unique.set(candidate.id, candidate);
	return [...unique.values()]
		.sort((a, b) => Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)))
		.slice(0, CANDIDATE_PAGE_SIZE + 1);
}

async function runNightlyStep(
	db: Firestore,
	season: number,
	key: Buffer,
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
		const indexed = prepareIndexedRoster(source, season, key);
		if (!indexed || indexed.revision === previous.get('revision')) {
			if (!indexed && previous.exists) transaction.delete(projectionRef);
			transaction.delete(pending.ref);
			return { created: 0 };
		}

		const marker = pending.data() as PendingRoster;
		const after =
			marker.revision === indexed.revision ? marker.after : undefined;
		const candidates = await nextCandidatePage(
			transaction,
			db,
			season,
			indexed.firstNameKeys,
			after,
		);
		const page = candidates.slice(0, CANDIDATE_PAGE_SIZE);
		const records = page
			.filter(({ id }) => id !== pending.id)
			.map((doc) => doc.data() as IndexedRoster);
		const cases = root.collection('cases');
		const known = records.length
			? await transaction.getAll(
					...records.map(({ registration }) =>
						cases.doc(
							registrationReviewCaseId(
								season,
								pending.id,
								registration.id,
							),
						),
					),
					{ fieldMask: [] },
				)
			: [];
		const proposals = detectRegistrationReviewPairs({
			season,
			changedIds: new Set([pending.id]),
			population: [
				indexed.registration,
				...records.map(({ registration }) => registration),
			],
			knownCaseIds: new Set(
				known.filter(({ exists }) => exists).map(({ id }) => id),
			),
			at,
		});

		// A candidate could have changed or canceled before its delta was
		// delivered. Reread only new matches from the canonical collection.
		const byId = new Map(
			records.map((row) => [row.registration.id, row.revision]),
		);
		const otherIds = proposals.map((review) =>
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
						prepareIndexedRoster(doc, season, key)?.revision ===
						byId.get(doc.id),
				)
				.map(({ id }) => id),
		);
		const confirmed = proposals.filter((_, index) =>
			current.has(otherIds[index]),
		);
		for (const review of confirmed)
			transaction.create(
				cases.doc(review.id),
				makeStoredReviewCase(review),
			);

		if (candidates.length > CANDIDATE_PAGE_SIZE) {
			transaction.update(pending.ref, {
				revision: indexed.revision,
				after: page.at(-1)!.id,
			});
		} else {
			transaction.set(projectionRef, indexed);
			transaction.delete(pending.ref);
		}
		return { created: confirmed.length };
	}, TRANSACTION_OPTIONS);
}

/** Drain only queued changes present at the start; no baseline or full-roster scan. */
export async function runRegistrationReviewNightly(
	db: Firestore,
	season: number,
	key: Buffer,
	cutoff: Date,
	maxSteps = REGISTRATION_REVIEW_NIGHTLY_MAX_STEPS,
): Promise<{ steps: number; created: number; mayHaveMore: boolean }> {
	if (key.length < 32)
		throw new Error('Registration review requires a 32-byte key.');
	const at = cutoff.toISOString();
	const highWater = Timestamp.fromDate(cutoff);
	const deadline = Date.now() + WORK_BUDGET_MS;
	let steps = 0;
	let created = 0;
	while (steps < maxSteps && Date.now() < deadline) {
		const result = await runNightlyStep(db, season, key, highWater, at);
		if (!result) return { steps, created, mayHaveMore: false };
		steps++;
		created += result.created;
	}
	return { steps, created, mayHaveMore: true };
}

// Explicit local dry-run setup only. The scheduler never calls this.
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

	const db = getFirestore(app);
	const root = getRegistrationReviewSeason(db, season);
	const baseline = root.collection('run').doc('baseline');
	const pending = root.collection('pendingRosters');
	const pageSize = 50;

	return db.runTransaction(async (transaction) => {
		const checkpoint = await transaction.get(baseline);
		if (checkpoint.get('done') === true)
			return { scanned: 0, queued: 0, mayHaveMore: false };

		const query = db
			.collection(COLLECTION_SCHEMA.registrations)
			.where('programYear', '==', season)
			.orderBy(FieldPath.documentId())
			.select('programYear', 'registrationSubmittedOn', 'cancelledOn')
			.limit(pageSize);
		const after = checkpoint.get('after') as string | undefined;
		const page = await transaction.get(
			after ? query.startAfter(after) : query,
		);
		const active = page.docs.filter((row) => rosterSource(row, season));
		const existing = active.length
			? await transaction.getAll(
					...active.map(({ id }) => pending.doc(id)),
				)
			: [];
		let queued = 0;
		for (const marker of existing) {
			if (marker.exists) continue;
			transaction.create(marker.ref, {
				eventId: 'local-baseline',
				queuedAt: FieldValue.serverTimestamp(),
			});
			queued++;
		}

		const mayHaveMore = page.size === pageSize;
		transaction.set(baseline, {
			done: !mayHaveMore,
			after: page.docs.at(-1)?.id ?? after ?? null,
		});
		return { scanned: page.size, queued, mayHaveMore };
	}, TRANSACTION_OPTIONS);
}
