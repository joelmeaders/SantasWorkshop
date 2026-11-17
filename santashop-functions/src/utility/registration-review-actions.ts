export const REVIEW_REPLY_TO = 'president@denversantaclausshop.org';

interface ReviewSelection {
	id: string;
	version: string;
}

interface ReviewCancellation extends ReviewSelection {
	programYear: number;
	originalSubmittedOn: Date;
	originalSlotId: string;
}

interface ReviewBlock extends ReviewSelection {
	uid: string;
	email: string;
	/** The current auth disable is still attributable to this block. */
	ownsAuthDisable: boolean;
}

interface ReviewRegistration extends ReviewSelection {
	programYear: number;
	email: string;
	isStaffAccount: boolean;
	hasCheckedIn: boolean;
	submittedOn: Date | null;
	slotId: string | null;
	cancellation: ReviewCancellation | null;
	block: ReviewBlock | null;
}

interface ReviewNotificationInput {
	recipient: string;
	customMessage?: string;
}

interface ReviewActionRequest {
	target: ReviewSelection;
	reason: string;
	notification: ReviewNotificationInput | null;
}

type ReviewAction =
	| (ReviewActionRequest & { kind: 'cancel' })
	| (ReviewActionRequest & {
			kind: 'reinstate';
			cancellation: ReviewSelection;
	  })
	| (ReviewActionRequest & {
			kind: 'blockEmail';
			cancellation: ReviewSelection;
	  })
	| (ReviewActionRequest & { kind: 'unblockEmail' });

interface ReviewActionContext {
	actor: { uid: string; isOwner: boolean; canReview: boolean };
	programYear: number;
	registration: ReviewRegistration | null;
	/** Provided from the stored original slot, never from a client-supplied ID. */
	originalSlot: { id: string; programYear: number } | null;
	/** Used by unblock, which can operate after the original registration season. */
	block: ReviewBlock | null;
}

interface ReviewActionPlanBase {
	actorUid: string;
	targetUid: string;
	reason: string;
	notification: {
		recipient: string;
		replyTo: typeof REVIEW_REPLY_TO;
		customMessage: string;
	} | null;
}

type ReviewActionPlan = ReviewActionPlanBase &
	(
		| { kind: 'cancel'; originalSubmittedOn: Date; originalSlotId: string }
		| {
				kind: 'reinstate';
				cancellationId: string;
				originalSubmittedOn: Date;
				originalSlotId: string;
				qrPolicy: 'issue-new-and-retain-old';
		  }
		| { kind: 'blockEmail'; email: string; cancellationId: string }
		| {
				kind: 'unblockEmail';
				blockId: string;
				releaseOwnedAuthDisable: boolean;
		  }
	);

type ReviewErrorCode =
	| 'permission-denied'
	| 'stale-selection'
	| 'invalid-argument'
	| 'failed-precondition';

export class ReviewActionError extends Error {
	constructor(
		public readonly code: ReviewErrorCode,
		message: string,
	) {
		super(message);
	}
}

const matches = (expected: ReviewSelection, actual: ReviewSelection): boolean =>
	expected.id === actual.id && expected.version === actual.version;

const normalizedEmail = (value: string): string => value.trim().toLowerCase();

const planBase = (
	request: ReviewActionRequest,
	actorUid: string,
	targetUid: string,
	currentEmail: string,
): ReviewActionPlanBase => {
	const reason = request.reason.trim();
	if (!reason || reason.length > 500) {
		throw new ReviewActionError(
			'invalid-argument',
			'Enter a reason of up to 500 characters.',
		);
	}
	if (!request.notification) {
		return { actorUid, targetUid, reason, notification: null };
	}
	const recipient = normalizedEmail(currentEmail);
	if (
		!recipient ||
		recipient !== normalizedEmail(request.notification.recipient)
	) {
		throw new ReviewActionError(
			'stale-selection',
			'The recipient changed. Review the email again.',
		);
	}
	const customMessage = request.notification.customMessage?.trim() ?? '';
	if (customMessage.length > 2_000) {
		throw new ReviewActionError(
			'invalid-argument',
			'The custom message must be at most 2,000 characters.',
		);
	}
	return {
		actorUid,
		targetUid,
		reason,
		notification: { recipient, replyTo: REVIEW_REPLY_TO, customMessage },
	};
};

/** Domain policy only. The caller must read authoritative state and commit atomically. */
export function planReviewAction(
	request: ReviewAction,
	context: ReviewActionContext,
): ReviewActionPlan {
	const { actor, registration } = context;
	const ownerOnly =
		request.kind === 'blockEmail' || request.kind === 'unblockEmail';
	if (!actor.uid || (!actor.isOwner && (ownerOnly || !actor.canReview))) {
		throw new ReviewActionError(
			'permission-denied',
			'Review permission is required.',
		);
	}
	if (request.kind === 'unblockEmail') {
		const block = context.block;
		if (!block || !matches(request.target, block)) {
			throw new ReviewActionError(
				'stale-selection',
				'The email block changed.',
			);
		}
		if (block.uid === actor.uid) {
			throw new ReviewActionError(
				'permission-denied',
				'Select another account.',
			);
		}
		return {
			...planBase(request, actor.uid, block.uid, block.email),
			kind: 'unblockEmail',
			blockId: block.id,
			releaseOwnedAuthDisable: block.ownsAuthDisable,
		};
	}
	if (!registration || !matches(request.target, registration)) {
		throw new ReviewActionError(
			'stale-selection',
			'The registration changed.',
		);
	}
	if (registration.isStaffAccount || registration.id === actor.uid) {
		throw new ReviewActionError(
			'permission-denied',
			'Select a shopper account.',
		);
	}
	if (
		registration.programYear !== context.programYear ||
		registration.hasCheckedIn
	) {
		throw new ReviewActionError(
			'failed-precondition',
			'This action requires a current-season registration that has not checked in.',
		);
	}
	const base = planBase(
		request,
		actor.uid,
		registration.id,
		registration.email,
	);
	if (request.kind === 'cancel') {
		if (
			!registration.submittedOn ||
			!registration.slotId ||
			registration.cancellation
		) {
			throw new ReviewActionError(
				'failed-precondition',
				'Only a submitted registration with an appointment can be canceled.',
			);
		}
		return {
			...base,
			kind: 'cancel',
			originalSubmittedOn: registration.submittedOn,
			originalSlotId: registration.slotId,
		};
	}
	const cancellation = registration.cancellation;
	if (
		!cancellation ||
		registration.submittedOn ||
		cancellation.programYear !== context.programYear ||
		!matches(request.cancellation, cancellation)
	) {
		throw new ReviewActionError(
			'failed-precondition',
			'Use the current cancellation record before taking this action.',
		);
	}
	if (registration.block) {
		throw new ReviewActionError(
			'failed-precondition',
			'Remove the active email block before taking this action.',
		);
	}
	if (request.kind === 'blockEmail') {
		const email = normalizedEmail(registration.email);
		if (!email) {
			throw new ReviewActionError(
				'failed-precondition',
				'The shopper email is unavailable.',
			);
		}
		return {
			...base,
			kind: 'blockEmail',
			email,
			cancellationId: cancellation.id,
		};
	}
	if (
		context.originalSlot?.id !== cancellation.originalSlotId ||
		context.originalSlot.programYear !== context.programYear
	) {
		throw new ReviewActionError(
			'failed-precondition',
			'The original appointment is no longer available to reinstate.',
		);
	}
	// Slot capacity is deliberately not checked. The same appointment is restored.
	return {
		...base,
		kind: 'reinstate',
		cancellationId: cancellation.id,
		originalSubmittedOn: cancellation.originalSubmittedOn,
		originalSlotId: cancellation.originalSlotId,
		qrPolicy: 'issue-new-and-retain-old',
	};
}
