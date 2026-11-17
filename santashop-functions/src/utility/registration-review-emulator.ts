import type { App } from 'firebase-admin/app';
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
	planRegistrationReviewBatch,
	type PreparedRegistration,
	type ReviewCase,
	type ReviewStatus,
} from './registration-review';
import {
	addReviewNote,
	getReviewCase,
	listReviewCases,
	makeStoredReviewCase,
	setReviewStatus,
	type ReviewCaseDetail,
	type ReviewCaseSummary,
	type ReviewQueueRequest,
} from './registration-review-store';

const ROOT = 'registrationReviewEmulator';
const JOB_SOURCE_PAGE = 25;
const MAX_PROJECTIONS = 1000;
const MAX_CASE_WRITES = 400;
type PreparedChange = { cursor: number; registration: PreparedRegistration };

function reviewScope(app: App, season: number): DocumentReference {
	// This first storage slice is intentionally unavailable on any real project.
	if (
		!/^127\.0\.0\.1:\d+$/u.test(
			process.env['FIRESTORE_EMULATOR_HOST'] ?? '',
		) ||
		app.options.projectId !== 'demo-registration-review'
	) {
		throw new Error(
			'This registration review slice requires its isolated emulator.',
		);
	}
	if (!Number.isInteger(season) || season < 2000 || season > 9999) {
		throw new HttpsError('invalid-argument', 'Invalid program year.');
	}
	return getFirestore(app).collection(ROOT).doc(String(season));
}

// Unexported from the Functions entrypoint. Emulator fixture changes are
// immutable and assigned a unique, increasing cursor by the fixture loader.
export async function runRegistrationReviewEmulatorBatch(
	app: App,
	season: number,
	at: string,
): Promise<{ cursor: number; created: number; mayHaveMore: boolean }> {
	const root = reviewScope(app, season);
	const checkpoint = root.collection('run').doc('checkpoint');
	const source = root.collection('preparedChanges');
	const projections = root.collection('rosterProjections');
	const cases = root.collection('cases');

	return root.firestore.runTransaction(async (transaction) => {
		const saved = await transaction.get(checkpoint);
		const cursor = (saved.data()?.['cursor'] as number | undefined) ?? 0;
		const changes = await transaction.get(
			source.orderBy('cursor').startAfter(cursor).limit(JOB_SOURCE_PAGE),
		);
		if (changes.empty) return { cursor, created: 0, mayHaveMore: false };

		const [projectionPage, casePage] = await Promise.all([
			transaction.get(projections.limit(MAX_PROJECTIONS + 1)),
			transaction.get(cases.select().limit(MAX_PROJECTIONS + 1)),
		]);
		if (
			projectionPage.size > MAX_PROJECTIONS ||
			casePage.size > MAX_PROJECTIONS
		) {
			throw new Error(
				'The emulator review projection limit was exceeded; the checkpoint was not advanced.',
			);
		}

		const plan = planRegistrationReviewBatch({
			season,
			checkpoint: { cursor },
			changes: changes.docs.map((doc) => doc.data() as PreparedChange),
			population: projectionPage.docs.map(
				(doc) => doc.data() as PreparedRegistration,
			),
			knownCaseIds: new Set(casePage.docs.map((doc) => doc.id)),
			at,
		});
		if (plan.newCases.length > MAX_CASE_WRITES) {
			throw new Error(
				'The emulator review case limit was exceeded; the checkpoint was not advanced.',
			);
		}

		for (const row of plan.indexUpdates) {
			transaction.set(projections.doc(row.id), row);
		}
		for (const review of plan.newCases) {
			transaction.create(
				cases.doc(review.id),
				makeStoredReviewCase(review),
			);
		}
		transaction.set(checkpoint, plan.checkpoint);
		return {
			cursor: plan.checkpoint.cursor,
			created: plan.newCases.length,
			mayHaveMore: changes.size === JOB_SOURCE_PAGE,
		};
	});
}

export async function listRegistrationReviewEmulatorCases(
	app: App,
	season: number,
	request: CallableRequest<ReviewQueueRequest>,
): Promise<{ cases: ReviewCaseSummary[]; nextCursor: string | null }> {
	return listReviewCases(reviewScope(app, season), season, request);
}

export async function getRegistrationReviewEmulatorCase(
	app: App,
	season: number,
	request: CallableRequest<{ id: string }>,
): Promise<ReviewCaseDetail> {
	return getReviewCase(reviewScope(app, season), request);
}

export async function setRegistrationReviewEmulatorStatus(
	app: App,
	season: number,
	request: CallableRequest<{ id: string; status: ReviewStatus }>,
	at: string,
): Promise<ReviewCase> {
	return setReviewStatus(reviewScope(app, season), request, at);
}

export async function addRegistrationReviewEmulatorNote(
	app: App,
	season: number,
	request: CallableRequest<{ id: string; noteId: string; text: string }>,
	at: string,
): Promise<ReviewCaseDetail> {
	return addReviewNote(reviewScope(app, season), request, at);
}
