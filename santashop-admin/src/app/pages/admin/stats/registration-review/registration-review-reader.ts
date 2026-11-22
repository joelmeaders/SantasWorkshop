import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

export type ReviewSearchMode = 'exact' | 'email-prefix';
export type ReviewQueueScope = 'open' | 'resolved' | 'all';
export type ReviewQueueStatus =
	'new' | 'pending-shopper-response' | 'hold' | 'resolved';
export type ReviewMatchTier =
	'strict' | 'balanced' | 'broader' | 'partial-roster';

export interface ReviewQueueSummary {
	readonly id: string;
	readonly season: number;
	readonly registrations: readonly [string, string];
	readonly tier: ReviewMatchTier;
	readonly evidence: {
		readonly firstNameMatches: number;
		readonly exactDateMatches: number;
		readonly fullNameMatches: number;
		readonly dobConflicts: number;
		readonly missingDobComparisons: number;
		readonly sameAdultName: boolean;
		readonly reliableContact: boolean;
		readonly sameZip: boolean;
		readonly rosterSizes: readonly [number, number];
	};
	readonly status: ReviewQueueStatus;
	readonly lastActionAt: string;
}

export type ReviewCaseEvent =
	| {
			readonly type: 'action-taken';
			readonly at: string;
			readonly actorUid: string;
			readonly action: ReviewMutationAction;
			readonly registrationId: string;
	  }
	| { readonly type: 'flagged'; readonly at: string }
	| {
			readonly type: 'status-changed';
			readonly at: string;
			readonly actorUid: string;
			readonly from: ReviewQueueStatus;
			readonly to: ReviewQueueStatus;
	  };

export type ReviewMutationAction =
	| 'contact'
	| 'editChild'
	| 'removeChild'
	| 'restoreChild'
	| 'disable'
	| 'enable'
	| 'cancel'
	| 'reinstate'
	| 'blacklist'
	| 'unblacklist';
export interface ReviewChildFields {
	readonly firstName: string;
	readonly lastName: string;
	readonly birthDate: string;
}
export interface ReviewCaseChild {
	readonly id?: string;
	readonly childIndex?: number;
	readonly name: string;
	readonly birthDate: string;
	readonly firstName?: string;
	readonly lastName?: string;
	readonly gift?: string;
	readonly enabled?: boolean;
	readonly removed?: boolean;
}
export interface ReviewCaseRegistration {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly appointment: string;
	readonly submitted?: string;
	readonly expectedRevision?: string;
	readonly canceled?: boolean;
	readonly checkedIn?: boolean;
	readonly accessDisabled?: boolean;
	readonly blacklisted?: boolean;
	readonly blockOperationPhase?:
		'applying' | 'failed' | 'confirmed' | 'cleared';
	readonly availableActions?: readonly string[];
	readonly children: readonly ReviewCaseChild[];
}
export interface ReviewMutationRequest {
	readonly caseId: string;
	readonly registrationId: string;
	readonly expectedRevision: string;
	readonly mutationId: string;
	readonly action: ReviewMutationAction;
	readonly reason: string;
	readonly notification?: {
		readonly recipient: string;
		readonly customMessage?: string;
	};
	readonly childIndex?: number;
	readonly child?: ReviewChildFields;
}
export interface ReviewMutationResult {
	readonly action: ReviewMutationAction;
	readonly registrationId: string;
	readonly notification: 'not-requested' | 'queued';
	readonly authAccess?: 'disabled-and-revoked' | 'requires-manual-review';
}

export const reviewSearchMaxLength = 254;
const reviewIdMaxLength = 80;

export function normalizeReviewSearch(
	value: string,
	mode: ReviewSearchMode = 'exact',
): string | null {
	const search = value.trim();
	if (!search) return '';
	if (mode === 'email-prefix') {
		return search.length >= 3 &&
			search.length <= reviewSearchMaxLength &&
			/^[a-z0-9][a-z0-9._+@-]*$/u.test(search.toLowerCase()) &&
			search.indexOf('@') === search.lastIndexOf('@')
			? search.toLowerCase()
			: null;
	}
	if (search.includes('@')) {
		return search.length <= reviewSearchMaxLength &&
			/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(search)
			? search.toLowerCase()
			: null;
	}
	return search.length <= reviewIdMaxLength && /^[A-Za-z0-9_-]+$/.test(search)
		? search
		: null;
}

export const reviewNoteMaxLength = 1_000;

export interface ReviewCaseNote {
	readonly id: string;
	readonly author: string;
	readonly at: string;
	readonly text: string;
}

export function normalizeReviewNote(value: string): string | null {
	const text = value.trim();
	return text && text.length <= reviewNoteMaxLength ? text : null;
}

export interface ReviewCaseDetail extends ReviewQueueSummary {
	readonly notes?: readonly ReviewCaseNote[];
	readonly history: readonly ReviewCaseEvent[];
	// Optional until an authorized live reader can supply the compared records.
	readonly records?: readonly [
		ReviewCaseRegistration | null,
		ReviewCaseRegistration | null,
	];
}

export interface ReviewQueuePage {
	readonly cases: readonly ReviewQueueSummary[];
	readonly nextCursor: string | null;
}

export interface ReviewListRequest {
	readonly scope: ReviewQueueScope;
	readonly limit: number;
	readonly after?: string;
	/** Exact case ID, registration reference, or adult email address; applied before pagination. */
	readonly search?: string;
	readonly searchMode?: ReviewSearchMode;
}

export interface RegistrationReviewReader {
	list(request: ReviewListRequest): Observable<ReviewQueuePage>;

	detail(request: { readonly id: string }): Observable<ReviewCaseDetail>;

	/** No default writer. A configured adapter must authenticate the reviewer. */
	appendNote?(request: {
		readonly id: string;
		readonly text: string;
		readonly noteId: string;
	}): Observable<ReviewCaseNote>;

	setStatus?(request: {
		readonly id: string;
		readonly status: ReviewQueueStatus;
	}): Observable<ReviewCaseDetail>;

	performAction?(
		request: ReviewMutationRequest,
	): Observable<ReviewMutationResult>;
}

// No default provider. Register the callable adapter only when review is enabled.
export const REGISTRATION_REVIEW_READER =
	new InjectionToken<RegistrationReviewReader>('Registration review reader');

export interface ReviewClaims {
	readonly [claim: string]: unknown;
	readonly owner?: unknown;
	readonly roles?: unknown;
}

export function canReadRegistrationReview(
	claims: ReviewClaims | null | undefined,
): boolean {
	return (
		claims?.owner === true ||
		(Array.isArray(claims?.roles) &&
			claims.roles.includes('admin') &&
			claims.roles.includes('registration-review'))
	);
}
