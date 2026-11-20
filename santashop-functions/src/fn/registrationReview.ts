import type { App } from 'firebase-admin/app';
import {
	getFirestore,
	type DocumentData,
	type DocumentSnapshot,
	type DocumentReference,
	type Firestore,
} from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import { getRegistrationReviewDenylist } from '../utility/registration-review-denylist-access';
import { requireRegistrationReviewRequestAccess } from './registrationReviewAccess';
import {
	addReviewNote,
	getRegistrationReviewSeason,
	getReviewCase,
	listReviewCases,
	setReviewStatus,
	type ReviewCaseDetail,
	type ReviewCaseSummary,
	type ReviewQueueRequest,
} from '../utility/registration-review-store';
import type { ReviewStatus } from '../utility/registration-review';
import { PROGRAM_YEAR } from '../utility/runtime-config';

type RegistrationReviewChild = {
	id: string;
	childIndex: number;
	name: string;
	firstName: string;
	lastName: string;
	birthDate: string;
	gift: string;
	enabled: boolean;
	removed: boolean;
};

export type RegistrationReviewRegistration = {
	id: string;
	name: string;
	email: string;
	zip: string;
	appointment: string;
	submitted: string;
	expectedRevision: string;
	canceled: boolean;
	checkedIn: boolean;
	accessDisabled: boolean;
	blacklisted: boolean;
	blockOperationPhase?: BlockOperationPhase;
	availableActions: readonly string[];
	children: readonly RegistrationReviewChild[];
};

export type RegistrationReviewCaseResult = ReviewCaseDetail & {
	registrationDetails: readonly [
		RegistrationReviewRegistration | null,
		RegistrationReviewRegistration | null,
	];
};

function scope(request: CallableRequest<unknown>, app: App): DocumentReference {
	requireRegistrationReviewRequestAccess(request);
	return getRegistrationReviewSeason(getFirestore(app), PROGRAM_YEAR);
}

function safeString(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function toIso(value: unknown): string {
	const raw =
		value &&
		typeof value === 'object' &&
		'toDate' in value &&
		typeof value.toDate === 'function'
			? value.toDate()
			: value;
	const date =
		raw instanceof Date
			? raw
			: typeof raw === 'string'
				? new Date(raw)
				: null;
	return date && Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function record(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function childDetails(
	value: unknown,
	removed: boolean,
): RegistrationReviewChild[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap(
		(child: unknown, childIndex): RegistrationReviewChild[] => {
			const data = record(child);
			const programYearAdded = data['programYearAdded'];
			if (
				Object.keys(data).length === 0 ||
				(typeof programYearAdded === 'number' &&
					programYearAdded > PROGRAM_YEAR)
			)
				return [];
			const firstName = safeString(data['firstName']);
			const lastName = safeString(data['lastName']);
			return [
				{
					id: removed
						? 'removed-' + String(childIndex)
						: String(childIndex),
					childIndex,
					name: [firstName, lastName].filter(Boolean).join(' '),
					firstName,
					lastName,
					birthDate: toIso(data['dateOfBirth']).slice(0, 10),
					gift: safeString(data['toyType']),
					enabled: !removed && data['enabled'] === true,
					removed,
				},
			];
		},
	);
}

type BlockOperationPhase = 'applying' | 'failed' | 'confirmed' | 'cleared';
type ReviewBlockVisibility = {
	active: boolean;
	action?: 'blacklist' | 'unblacklist';
	phase?: BlockOperationPhase;
};

async function readReviewBlock(
	db: Firestore,
	snapshot: DocumentSnapshot | undefined,
	caseId: string,
): Promise<ReviewBlockVisibility> {
	const data = snapshot?.data();
	if (!snapshot || !data || data['programYear'] !== PROGRAM_YEAR)
		return { active: false };
	const denylist = getRegistrationReviewDenylist(db);

	const email = safeString(data['emailAddress']).trim().toLowerCase();
	const cancellationId = safeString(data['cancellationLogId']);
	const canceled =
		Boolean(toIso(data['cancelledOn'])) && cancellationId.length > 0;
	const [uidBlock, emailBlock, operation] = await Promise.all([
		denylist.isUidBlocked(snapshot.id),
		email ? denylist.isEmailBlocked(email) : false,
		canceled
			? db
					.collection('registrationReviewAuthOperations')
					.doc(snapshot.id)
					.get()
			: null,
	]);
	const active = uidBlock || emailBlock;
	const matchingOperation =
		operation?.get('caseId') === caseId &&
		operation?.get('cancellationId') === cancellationId;
	const state: unknown = matchingOperation
		? operation?.get('state')
		: undefined;
	const phase =
		state === 'applying' ||
		state === 'failed' ||
		state === 'confirmed' ||
		state === 'cleared'
			? state
			: undefined;
	let action: ReviewBlockVisibility['action'];
	if (canceled && email) {
		if (uidBlock && emailBlock && phase === 'failed') action = 'blacklist';
		if (uidBlock && emailBlock && phase === 'confirmed')
			action = 'unblacklist';
		if (!active && (phase === undefined || phase === 'cleared'))
			action = 'blacklist';
	}
	return {
		active,
		...(phase ? { phase } : {}),
		...(action ? { action } : {}),
	};
}

function registrationDetails(
	snapshot: DocumentSnapshot | undefined,
	access: DocumentData | undefined,
	options: {
		checkedIn: boolean;
		shopper: boolean;
		removedChildren: unknown;
		block: ReviewBlockVisibility;
	},
): RegistrationReviewRegistration | null {
	const data = snapshot?.data();
	if (
		!snapshot ||
		!data ||
		data['programYear'] !== PROGRAM_YEAR ||
		!snapshot.updateTime
	)
		return null;
	const canceled = Boolean(toIso(data['cancelledOn']));
	const checkedIn = options.checkedIn || data['hasCheckedIn'] === true;
	const accessDisabled = access?.['disabled'] === true;
	const submitted = toIso(data['registrationSubmittedOn']);
	const appointment = record(data['dateTimeSlot']);
	const hasTicket = Boolean(data['qrcode'] && data['qrCodeStoragePath']);
	const children = [
		...childDetails(data['children'], false),
		...childDetails(options.removedChildren, true),
	];
	const availableActions: string[] = [];
	if (
		!checkedIn &&
		options.shopper &&
		(!data['uid'] || data['uid'] === snapshot.id)
	) {
		if (safeString(data['emailAddress'])) availableActions.push('contact');
		if (!options.block.active)
			availableActions.push(accessDisabled ? 'enable' : 'disable');
		if (
			!canceled &&
			submitted &&
			appointment['id'] &&
			toIso(appointment['dateTime']) &&
			hasTicket
		)
			availableActions.push('cancel');
		if (
			!options.block.active &&
			canceled &&
			!submitted &&
			data['cancellationLogId'] &&
			hasTicket
		)
			availableActions.push('reinstate');
		if (children.some((child) => !child.removed))
			availableActions.push('editChild', 'removeChild');
		if (options.block.action) availableActions.push(options.block.action);
		if (children.some((child) => child.removed))
			availableActions.push('restoreChild');
	}
	return {
		id: snapshot.id,
		name: [safeString(data['firstName']), safeString(data['lastName'])]
			.filter(Boolean)
			.join(' '),
		email: safeString(data['emailAddress']),
		zip: safeString(data['zipCode']),
		appointment: toIso(appointment['dateTime']),
		submitted,
		expectedRevision: `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}`,
		canceled,
		checkedIn,
		accessDisabled,
		blacklisted: options.block.active,
		...(options.block.phase
			? { blockOperationPhase: options.block.phase }
			: {}),
		availableActions,
		children,
	};
}

async function hydrateCase(
	root: DocumentReference,
	review: ReviewCaseDetail,
): Promise<RegistrationReviewCaseResult> {
	const db = root.firestore;
	const [
		left,
		right,
		leftAccess,
		rightAccess,
		leftCheckin,
		rightCheckin,
		leftUser,
		rightUser,
		leftStaff,
		rightStaff,
		leftRoster,
		rightRoster,
	] = await db.getAll(
		...review.registrations.map((id) =>
			db.collection('registrations').doc(id),
		),
		...review.registrations.map((id) =>
			db.collection('shopperAccess').doc(id),
		),
		...review.registrations.map((id) => db.collection('checkins').doc(id)),
		...review.registrations.map((id) => db.collection('users').doc(id)),
		...review.registrations.map((id) => db.collection('staff').doc(id)),
		...review.registrations.map((id) =>
			db
				.collection('registrations')
				.doc(id)
				.collection('review')
				.doc('roster'),
		),
	);
	const [leftBlock, rightBlock] = await Promise.all([
		readReviewBlock(db, left, review.id),
		readReviewBlock(db, right, review.id),
	]);
	return {
		...review,
		registrationDetails: [
			registrationDetails(left, leftAccess?.data(), {
				checkedIn: leftCheckin?.exists === true,
				removedChildren: leftRoster?.get('children'),
				block: leftBlock,
				shopper:
					leftUser?.exists === true && leftStaff?.exists === false,
			}),
			registrationDetails(right, rightAccess?.data(), {
				checkedIn: rightCheckin?.exists === true,
				removedChildren: rightRoster?.get('children'),
				block: rightBlock,
				shopper:
					rightUser?.exists === true && rightStaff?.exists === false,
			}),
		],
	};
}

export async function listRegistrationReviewCases(
	request: CallableRequest<ReviewQueueRequest>,
	app: App = admin.app(),
): Promise<{ cases: ReviewCaseSummary[]; nextCursor: string | null }> {
	return listReviewCases(scope(request, app), PROGRAM_YEAR, request);
}

export async function getRegistrationReviewCase(
	request: CallableRequest<{ id: string }>,
	app: App = admin.app(),
): Promise<RegistrationReviewCaseResult> {
	const root = scope(request, app);
	return hydrateCase(root, await getReviewCase(root, request));
}

export async function setRegistrationReviewStatus(
	request: CallableRequest<{ id: string; status: ReviewStatus }>,
	app: App = admin.app(),
): Promise<RegistrationReviewCaseResult> {
	const root = scope(request, app);
	await setReviewStatus(root, request, new Date().toISOString());
	return hydrateCase(root, await getReviewCase(root, request));
}

export async function addRegistrationReviewNote(
	request: CallableRequest<{ id: string; noteId: string; text: string }>,
	app: App = admin.app(),
): Promise<RegistrationReviewCaseResult> {
	const root = scope(request, app);
	const review = await addReviewNote(root, request, new Date().toISOString());
	return hydrateCase(root, review);
}
