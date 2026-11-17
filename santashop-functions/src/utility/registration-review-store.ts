import {
	FieldPath,
	type CollectionReference,
	type DocumentReference,
	type Firestore,
} from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
	CallableValidationError,
	requireEmailAddress,
} from './callable-validation';
import { requireRegistrationReviewAccess } from './capabilities';
import {
	changeRegistrationReviewStatus,
	normalizeRegistrationReviewNote,
	type ReviewCase,
	type ReviewStatus,
	type ReviewNote,
	reviewTiers,
} from './registration-review';

const MAX_EMAIL_REGISTRATIONS = 20;

export type ReviewCaseSummary = Omit<ReviewCase, 'history'>;
export type ReviewCaseDetail = ReviewCase & { notes: readonly ReviewNote[] };

type StoredCase = ReviewCase & {
	hasOpenStatus: boolean;
	tierRank: number;
	fullRosterFraction: number;
	leftId: string;
	rightId: string;
	searchReferences: readonly string[];
};

type ReviewScope = 'open' | 'resolved' | 'all';

export type ReviewQueueRequest = {
	scope?: ReviewScope;
	limit?: number;
	after?: string;
	search?: string;
	searchMode?: 'exact' | 'email-prefix';
};

export function getRegistrationReviewSeason(
	db: Firestore,
	season: number,
): DocumentReference {
	if (!Number.isInteger(season) || season < 2000 || season > 2100) {
		throw new HttpsError('invalid-argument', 'Invalid program year.');
	}
	return db.collection('registrationReviewSeasons').doc(String(season));
}

function reportIdSortKey(id: string): string {
	// The report only accepts ASCII IDs. Store primary letter/punctuation
	// weights followed by lower-case-before-upper-case tie breakers.
	const primary = id.toLowerCase().replaceAll('_', '!').replaceAll('-', '"');
	const caseWeights = [...id]
		.map((letter) => (/[A-Z]/u.test(letter) ? '1' : '0'))
		.join('');
	return primary + ' ' + caseWeights;
}

export function makeStoredReviewCase(review: ReviewCase): StoredCase {
	return {
		...review,
		hasOpenStatus: review.status !== 'resolved',
		tierRank: reviewTiers.indexOf(review.tier),
		leftId: reportIdSortKey(review.registrations[0]),
		rightId: reportIdSortKey(review.registrations[1]),
		searchReferences: [review.id, ...review.registrations],
		fullRosterFraction:
			review.evidence.firstNameMatches /
			Math.max(...review.evidence.rosterSizes),
	};
}

function caseSummary(review: StoredCase): ReviewCaseSummary {
	return {
		id: review.id,
		season: review.season,
		registrations: review.registrations,
		tier: review.tier,
		evidence: review.evidence,
		status: review.status,
		lastActionAt: review.lastActionAt,
	};
}

function caseId(id: unknown): string {
	if (typeof id !== 'string' || !/^[a-f0-9]{64}$/u.test(id)) {
		throw new HttpsError(
			'invalid-argument',
			'Invalid review case identifier.',
		);
	}
	return id;
}

type QueueSearch = {
	type: 'reference' | 'email' | 'email-prefix';
	value: string;
};

function parseQueueSearch(value: unknown, mode: unknown): QueueSearch | null {
	if (mode !== undefined && mode !== 'exact' && mode !== 'email-prefix') {
		throw new HttpsError(
			'invalid-argument',
			'Choose a valid registration review search mode.',
		);
	}
	if (mode === 'email-prefix') {
		const prefix =
			typeof value === 'string' ? value.trim().toLowerCase() : '';
		if (
			prefix.length < 3 ||
			prefix.length > 254 ||
			!/^[a-z0-9][a-z0-9._+@-]*$/u.test(prefix) ||
			prefix.indexOf('@') !== prefix.lastIndexOf('@')
		) {
			throw new HttpsError(
				'invalid-argument',
				'Enter at least three characters from the start of the shopper email.',
			);
		}
		return { type: 'email-prefix', value: prefix };
	}

	if (value === undefined) return null;
	if (typeof value === 'string') {
		const search = value.trim();
		if (!search) return null;
		if (search.includes('@')) {
			try {
				return { type: 'email', value: requireEmailAddress(search) };
			} catch (error: unknown) {
				if (!(error instanceof CallableValidationError)) throw error;
				throw new HttpsError(
					'invalid-argument',
					'Enter a complete shopper email address.',
				);
			}
		}
		if (search.length <= 80 && /^[A-Za-z0-9_-]+$/u.test(search)) {
			return { type: 'reference', value: search };
		}
	}
	throw new HttpsError(
		'invalid-argument',
		'Enter a complete shopper email, case reference, or registration reference.',
	);
}

async function shopperRegistrationReferences(
	root: DocumentReference,
	season: number,
	email: string,
	prefix: boolean,
): Promise<string[]> {
	// Use the protected canonical registration, not registrationsearchindex:
	// cancellation removes the latter but preserves program year and email here.
	const registrations = root.firestore
		.collection('registrations')
		.where('programYear', '==', season);
	// ASCII prefix validation makes this upper bound valid even when an address
	// contains a Unicode suffix. Match [prefix, next ASCII prefix).
	const prefixBound =
		email.slice(0, -1) +
		String.fromCharCode(email.charCodeAt(email.length - 1) + 1);
	const query = prefix
		? registrations
				.orderBy('emailAddress')
				.startAt(email)
				.endBefore(prefixBound)
		: registrations.where('emailAddress', '==', email);
	const matches = await query
		.select()
		.limit(MAX_EMAIL_REGISTRATIONS + 1)
		.get()
		.catch(() => {
			throw new HttpsError(
				'unavailable',
				'Shopper email lookup is unavailable.',
			);
		});
	if (matches.size > MAX_EMAIL_REGISTRATIONS) {
		throw new HttpsError(
			'resource-exhausted',
			prefix
				? 'Too many email matches. Enter more characters from the beginning of the email.'
				: 'Too many registrations share that email. Search for a registration or case reference instead.',
		);
	}
	return matches.docs.map(({ id }) => id);
}

function getCases(root: DocumentReference): CollectionReference {
	return root.collection('cases');
}

export async function listReviewCases(
	root: DocumentReference,
	season: number,
	request: CallableRequest<ReviewQueueRequest>,
): Promise<{ cases: ReviewCaseSummary[]; nextCursor: string | null }> {
	requireRegistrationReviewAccess(request);

	const cases = getCases(root);
	const { scope = 'open', limit = 25, after } = request.data ?? {};
	const search = parseQueueSearch(
		request.data?.search,
		request.data?.searchMode,
	);
	if (
		!['open', 'resolved', 'all'].includes(scope) ||
		!Number.isInteger(limit) ||
		limit < 1 ||
		limit > 100
	) {
		throw new HttpsError(
			'invalid-argument',
			'Invalid review queue options.',
		);
	}

	let query =
		scope === 'all'
			? cases
			: cases.where('hasOpenStatus', '==', scope === 'open');
	const references =
		search && search.type !== 'reference'
			? await shopperRegistrationReferences(
					root,
					season,
					search.value,
					search.type === 'email-prefix',
				)
			: search
				? [search.value]
				: [];
	if (search && references.length === 0)
		return { cases: [], nextCursor: null };
	const [firstReference] = references;
	if (references.length > 1) {
		query = query.where(
			'searchReferences',
			'array-contains-any',
			references,
		);
	} else if (firstReference) {
		query = query.where(
			'searchReferences',
			'array-contains',
			firstReference,
		);
	}
	// Same sort order as the report, projected onto queryable fields.
	query = query
		.orderBy('tierRank')
		.orderBy('evidence.exactDateMatches', 'desc')
		.orderBy('evidence.firstNameMatches', 'desc')
		.orderBy('fullRosterFraction', 'desc')
		.orderBy('leftId')
		.orderBy('rightId')
		.orderBy(FieldPath.documentId());
	if (after !== undefined) {
		const anchor = await cases.doc(caseId(after)).get();
		if (!anchor.exists)
			throw new HttpsError('not-found', 'Review queue cursor not found.');
		if (
			search &&
			!references.some((ref) =>
				(anchor.data() as StoredCase).searchReferences?.includes(ref),
			)
		) {
			throw new HttpsError(
				'invalid-argument',
				'Start a new page when the review search changes.',
			);
		}
		query = query.startAfter(anchor);
	}
	const result = await query.limit(limit + 1).get();
	const page = result.docs.slice(0, limit);
	return {
		cases: page.map((doc) => caseSummary(doc.data() as StoredCase)),
		nextCursor: result.size > limit ? (page.at(-1)?.id ?? null) : null,
	};
}

export async function getReviewCase(
	root: DocumentReference,

	request: CallableRequest<{ id: string }>,
): Promise<ReviewCaseDetail> {
	requireRegistrationReviewAccess(request);

	const cases = getCases(root);
	const ref = cases.doc(caseId(request.data?.id));
	const review = (await ref.get()).data() as StoredCase | undefined;
	if (!review) throw new HttpsError('not-found', 'Review case not found.');
	const notes = await ref
		.collection('notes')
		.orderBy('at')
		.orderBy(FieldPath.documentId())
		.get();
	return {
		...caseSummary(review),
		history: review.history,
		notes: notes.docs.map((doc) => doc.data() as ReviewNote),
	};
}

export async function setReviewStatus(
	root: DocumentReference,

	request: CallableRequest<{ id: string; status: ReviewStatus }>,
	at: string,
): Promise<ReviewCase> {
	const actor = requireRegistrationReviewAccess(request);
	const ref = getCases(root).doc(caseId(request.data?.id));
	const status = request.data?.status;
	if (
		!['new', 'pending-shopper-response', 'hold', 'resolved'].includes(
			status,
		)
	) {
		throw new HttpsError('invalid-argument', 'Invalid review status.');
	}
	return ref.firestore.runTransaction(async (transaction) => {
		const existing = (await transaction.get(ref)).data() as
			StoredCase | undefined;
		if (!existing)
			throw new HttpsError('not-found', 'Review case not found.');
		const previous = {
			...caseSummary(existing),
			history: existing.history,
		};
		const updated = changeRegistrationReviewStatus(
			previous,
			status,
			actor,
			at,
		);
		if (updated !== previous)
			transaction.update(ref, {
				status: updated.status,
				lastActionAt: updated.lastActionAt,
				history: updated.history,
				hasOpenStatus: updated.status !== 'resolved',
			});
		return updated;
	});
}

export async function addReviewNote(
	root: DocumentReference,

	request: CallableRequest<{ id: string; noteId: string; text: string }>,
	at: string,
): Promise<ReviewCaseDetail> {
	const actorUid = requireRegistrationReviewAccess(request);

	const id = caseId(request.data?.id);
	const noteId = request.data?.noteId;
	const text = normalizeRegistrationReviewNote(request.data?.text);
	if (typeof noteId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/u.test(noteId)) {
		throw new HttpsError(
			'invalid-argument',
			'Invalid internal note identifier.',
		);
	}
	if (text === null) {
		throw new HttpsError(
			'invalid-argument',
			'Enter a meaningful internal note of at most 1000 characters.',
		);
	}

	const parent = getCases(root).doc(id);
	const ref = parent.collection('notes').doc(noteId);
	await root.firestore.runTransaction(async (transaction) => {
		const [review, existing] = await transaction.getAll(parent, ref);
		if (!review?.exists) {
			throw new HttpsError('not-found', 'Review case not found.');
		}
		const previous = existing?.data() as ReviewNote | undefined;
		if (previous) {
			if (previous.actorUid === actorUid && previous.text === text)
				return;
			throw new HttpsError(
				'already-exists',
				'This internal note identifier is already in use.',
			);
		}
		const note: ReviewNote = { id: noteId, text, actorUid, at };
		transaction.create(ref, note);
	});
	return getReviewCase(root, request);
}
