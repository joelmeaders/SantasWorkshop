import { SHOPPER_ACCESS_REASONS } from './shopper-access';

const accessReasons = [
	SHOPPER_ACCESS_REASONS[0],
	'both-parents-registered-same-children',
	...SHOPPER_ACCESS_REASONS.slice(1),
] as const;

export const REGISTRATION_REVIEW_REASON_CODES = {
	contact: ['verify-registration', 'follow-up'],
	editChild: ['correct-child-information'],
	removeChild: ['duplicate-child-entry', 'correct-child-information'],
	restoreChild: ['child-removed-in-error'],
	disable: accessReasons,
	enable: ['reviewed-and-cleared'],
	cancel: [
		'duplicate-registration',
		'both-parents-registered-same-children',
		'cancellation-requested-by-shopper',
		'registration-information-unverified',
	],
	reinstate: ['cancellation-in-error', 'reviewed-and-cleared'],
	blacklist: accessReasons,
	unblacklist: ['reviewed-and-cleared', 'block-in-error'],
} as const;

export type RegistrationReviewReasonCode =
	(typeof REGISTRATION_REVIEW_REASON_CODES)[keyof typeof REGISTRATION_REVIEW_REASON_CODES][number];

export function isRegistrationReviewReason(
	action: keyof typeof REGISTRATION_REVIEW_REASON_CODES,
	reason: string,
): reason is RegistrationReviewReasonCode {
	const choices: readonly string[] = REGISTRATION_REVIEW_REASON_CODES[action];
	return choices.includes(reason);
}

export function isRegistrationReviewChildAction(
	action: keyof typeof REGISTRATION_REVIEW_REASON_CODES,
): boolean {
	return (
		action === 'editChild' ||
		action === 'removeChild' ||
		action === 'restoreChild'
	);
}
