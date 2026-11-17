import { STAFF_ROLES } from '../models';
import { requireEmailAddress } from './callable-validation';

interface AuthPrincipal {
	uid: string;
	email?: string;
	emailVerified: boolean;
	disabled: boolean;
	customClaims?: Record<string, unknown>;
}

interface DenylistAuth {
	getUser(uid: string): Promise<AuthPrincipal>;
	updateUser(uid: string, changes: { disabled: true }): Promise<unknown>;
	revokeRefreshTokens(uid: string): Promise<void>;
}

interface DenylistAuthTarget {
	uid: string;
	email: string;
	actorUid?: string;
}

export class DenylistAuthTargetError extends Error {}

const isStaff = (claims: AuthPrincipal['customClaims']): boolean => {
	if (!claims) return false;
	const roles: unknown = claims['roles'];
	return (
		claims['owner'] === true ||
		claims['admin'] === true ||
		claims['checkin'] === true ||
		(Array.isArray(roles) &&
			STAFF_ROLES.some((role) => roles.includes(role)))
	);
};

export const verifyRegistrationReviewAuthTarget = async (
	target: DenylistAuthTarget,
	auth: DenylistAuth,
): Promise<AuthPrincipal> => {
	const expectedEmail = requireEmailAddress(target.email);
	if (target.uid === target.actorUid)
		throw new DenylistAuthTargetError('Cannot disable the acting account.');

	const principal = await auth.getUser(target.uid);
	if (
		principal.uid !== target.uid ||
		!principal.emailVerified ||
		principal.email?.trim().toLowerCase() !== expectedEmail
	)
		throw new DenylistAuthTargetError('Verified account identity changed.');

	if (isStaff(principal.customClaims))
		throw new DenylistAuthTargetError('Cannot disable a staff account.');

	return principal;
};

/**
 * Apply the Auth side effect only after committing a current denylist policy.
 * A failure does not roll back the policy. The caller must record repair state
 * and recheck that policy before retrying. This helper never enables an account.
 */
export const applyRegistrationReviewAuthDenylist = async (
	target: DenylistAuthTarget,
	auth: DenylistAuth,
): Promise<void> => {
	const principal = await verifyRegistrationReviewAuthTarget(target, auth);
	if (!principal.disabled)
		await auth.updateUser(target.uid, { disabled: true });
	await auth.revokeRefreshTokens(target.uid);
};
