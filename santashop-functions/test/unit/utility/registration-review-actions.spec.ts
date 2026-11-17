import { describe, expect, it } from 'vitest';
import {
	planReviewAction,
	ReviewActionError,
} from '../../../src/utility/registration-review-actions';

type Context = Parameters<typeof planReviewAction>[1];

const submittedOn = new Date('2026-11-15T15:15:00Z');
const target = { id: 'shopper-001', version: 'registration-revision-2' };
const cancellation = {
	id: 'cancellation-001',
	version: 'cancellation-revision-1',
	originalSubmittedOn: submittedOn,
	originalSlotId: 'original-slot',
	programYear: 2026,
};
const email = 'shopper@example.invalid';
const baseRequest = {
	target,
	reason: 'Confirmed with shopper.',
	notification: null,
};
const admin = { uid: 'staff-001', canReview: false, isOwner: false };
const reviewer = { ...admin, canReview: true };
const owner = { ...admin, isOwner: true };
const active = {
	...target,
	programYear: 2026,
	email,
	isStaffAccount: false,
	hasCheckedIn: false,
	submittedOn,
	slotId: 'original-slot',
	cancellation: null,
	block: null,
};
const canceled = { ...active, submittedOn: null, slotId: null, cancellation };
const fullSlot = {
	id: 'original-slot',
	programYear: 2026,
	slotsReserved: 10,
	maxSlots: 10,
};
const context = (
	registration: Context['registration'] = active,
	actor: Context['actor'] = reviewer,
): Context => ({
	actor,
	registration,
	programYear: 2026,
	block: null,
	originalSlot: fullSlot,
});

describe('registration review action policy', () => {
	it('lets the owner or delegated reviewer cancel an active ticket while preserving booking provenance', () => {
		for (const actor of [owner, reviewer]) {
			expect(
				planReviewAction(
					{ ...baseRequest, kind: 'cancel' },
					context(active, actor),
				),
			).toEqual({
				kind: 'cancel',
				reason: baseRequest.reason,
				actorUid: actor.uid,
				targetUid: target.id,
				originalSubmittedOn: submittedOn,
				originalSlotId: 'original-slot',
				notification: null,
			});
		}
		expect(() =>
			planReviewAction(
				{ ...baseRequest, kind: 'cancel' },
				context(active, admin),
			),
		).toThrow(
			new ReviewActionError(
				'permission-denied',
				'Review permission is required.',
			),
		);
	});

	it('rejects stale selection, checked-in, out-of-season, and staff registrations', () => {
		const request = { ...baseRequest, kind: 'cancel' as const };
		expect(() =>
			planReviewAction(
				request,
				context({ ...active, version: 'changed' }),
			),
		).toThrow('The registration changed.');
		expect(() =>
			planReviewAction(
				request,
				context({ ...active, id: 'other-registration' }),
			),
		).toThrow('The registration changed.');
		for (const registration of [
			{ ...active, hasCheckedIn: true },
			{ ...active, programYear: 2025 },
		]) {
			expect(() =>
				planReviewAction(request, context(registration)),
			).toThrow(
				'requires a current-season registration that has not checked in',
			);
		}
		expect(() =>
			planReviewAction(
				request,
				context({ ...active, isStaffAccount: true }),
			),
		).toThrow('Select a shopper account.');
		expect(() => planReviewAction(request, context(canceled))).toThrow(
			'Only a submitted registration',
		);
		expect(() =>
			planReviewAction({ ...request, reason: '  ' }, context()),
		).toThrow('Enter a reason');
	});

	it('freezes the reviewed canonical recipient and a fixed Reply-To, never the other registration’s address', () => {
		const request = {
			...baseRequest,
			kind: 'cancel' as const,
			notification: {
				recipient: ' SHOPPER@example.invalid ',
				customMessage: '  Please reply with questions.  ',
			},
		};
		expect(planReviewAction(request, context()).notification).toEqual({
			recipient: email,
			replyTo: 'president@denversantaclausshop.org',
			customMessage: 'Please reply with questions.',
		});
		expect(() =>
			planReviewAction(
				request,
				context({ ...active, email: 'new@example.invalid' }),
			),
		).toThrow('The recipient changed.');
	});

	it('reinstates the original full slot and calls for a fresh QR, only for the latest cancellation', () => {
		const request = {
			...baseRequest,
			kind: 'reinstate' as const,
			cancellation,
		};
		expect(planReviewAction(request, context(canceled))).toMatchObject({
			kind: 'reinstate',
			cancellationId: cancellation.id,
			originalSubmittedOn: submittedOn,
			originalSlotId: fullSlot.id,
			qrPolicy: 'issue-new-and-retain-old',
		});
		expect(() =>
			planReviewAction(request, {
				...context(canceled),
				originalSlot: null,
			}),
		).toThrow('original appointment is no longer available');
		expect(() =>
			planReviewAction(
				request,
				context({
					...canceled,
					cancellation: {
						...cancellation,
						version: 'new-cancellation',
					},
				}),
			),
		).toThrow('Use the current cancellation record');
		expect(() => planReviewAction(request, context(active))).toThrow(
			'Use the current cancellation record',
		);
	});

	it('limits permanent email blocks to owners after a current cancellation', () => {
		const request = {
			...baseRequest,
			kind: 'blockEmail' as const,
			cancellation,
		};
		expect(() => planReviewAction(request, context(canceled))).toThrow(
			'Review permission',
		);
		expect(() => planReviewAction(request, context(active, owner))).toThrow(
			'Use the current cancellation record',
		);
		expect(
			planReviewAction(request, context(canceled, owner)),
		).toMatchObject({
			kind: 'blockEmail',
			email,
			cancellationId: cancellation.id,
		});
	});

	it('unblocks across seasons without clearing an unrelated auth restriction', () => {
		const block = {
			id: 'private-block-key',
			version: 'block-revision-1',
			uid: target.id,
			email,
			ownsAuthDisable: false,
		};
		const request = {
			...baseRequest,
			kind: 'unblockEmail' as const,
			target: block,
		};
		const nextSeason = {
			...context(null, owner),
			programYear: 2027,
			block,
		};
		expect(planReviewAction(request, nextSeason)).toMatchObject({
			kind: 'unblockEmail',
			targetUid: target.id,
			blockId: block.id,
			releaseOwnedAuthDisable: false,
		});
		expect(
			planReviewAction(request, {
				...nextSeason,
				block: { ...block, ownsAuthDisable: true },
			}),
		).toMatchObject({ releaseOwnedAuthDisable: true });
		expect(() =>
			planReviewAction(request, { ...nextSeason, actor: reviewer }),
		).toThrow('Review permission');
		expect(() =>
			planReviewAction(request, {
				...nextSeason,
				block: { ...block, version: 'new-block' },
			}),
		).toThrow('The email block changed.');
	});
});
