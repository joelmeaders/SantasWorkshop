import { describe, expect, it, vi } from 'vitest';
import {
	applyRegistrationReviewAuthDenylist,
	DenylistAuthTargetError,
} from '../../../src/utility/registration-review-denylist-auth';

type Auth = Parameters<typeof applyRegistrationReviewAuthDenylist>[1];
type Principal = Awaited<ReturnType<Auth['getUser']>>;

const target = { uid: 'shopper', email: ' Shopper@example.invalid ', actorUid: 'owner' };
const setup = (override: Partial<Principal> = {}) => {
	const principal: Principal = {
		uid: target.uid,
		email: 'shopper@example.invalid',
		emailVerified: true,
		disabled: false,
		...override,
	};
	const auth = {
		getUser: vi.fn(async () => principal),
		updateUser: vi.fn(async () => {
			principal.disabled = true;
		}),
		revokeRefreshTokens: vi.fn(async () => {}),
	};
	return { auth, principal };
};

describe('registration review Auth denylist side effect', () => {
	it('reads the verified identity, disables its UID, then revokes refresh tokens', async () => {
		const { auth } = setup();
		await applyRegistrationReviewAuthDenylist(target, auth);
		expect(auth.getUser).toHaveBeenCalledExactlyOnceWith(target.uid);
		expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith(target.uid, { disabled: true });
		expect(auth.revokeRefreshTokens).toHaveBeenCalledExactlyOnceWith(target.uid);
		expect(auth.updateUser).toHaveBeenCalledBefore(auth.revokeRefreshTokens);
	});

	it.each([
		{ uid: 'different-user' },
		{ email: 'different@example.invalid' },
		{ email: undefined },
		{ emailVerified: false },
		{ customClaims: { owner: true } },
		{ customClaims: { admin: true } },
		{ customClaims: { checkin: true } },
		{ customClaims: { roles: ['admin'] } },
		{ customClaims: { roles: ['checkin'] } },
		{ customClaims: { roles: ['registration-review'] } },
	])('refuses a wrong, unverified, or protected principal: %j', async (override) => {
		const { auth } = setup(override);
		await expect(applyRegistrationReviewAuthDenylist(target, auth)).rejects.toBeInstanceOf(
			DenylistAuthTargetError,
		);
		expect(auth.updateUser).not.toHaveBeenCalled();
		expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();
	});

	it('refuses self-targeting, even if claims do not show a staff role', async () => {
		const { auth } = setup();
		await expect(
			applyRegistrationReviewAuthDenylist({ ...target, actorUid: target.uid }, auth),
		).rejects.toBeInstanceOf(DenylistAuthTargetError);
		expect(auth.getUser).not.toHaveBeenCalled();
	});

	it('reports a failed disable and does not revoke until Auth accepts the disable', async () => {
		const { auth } = setup();
		const error = new Error('Auth unavailable');
		auth.updateUser.mockRejectedValueOnce(error);
		await expect(applyRegistrationReviewAuthDenylist(target, auth)).rejects.toBe(error);
		expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();
	});

	it('retries failed revocation without writing the disabled bit again', async () => {
		const { auth, principal } = setup();
		const error = new Error('Auth unavailable');
		auth.revokeRefreshTokens.mockRejectedValueOnce(error);
		await expect(applyRegistrationReviewAuthDenylist(target, auth)).rejects.toBe(error);
		expect(principal.disabled).toBe(true);

		await applyRegistrationReviewAuthDenylist(target, auth);
		expect(auth.getUser).toHaveBeenCalledTimes(2);
		expect(auth.updateUser).toHaveBeenCalledTimes(1);
		expect(auth.revokeRefreshTokens).toHaveBeenCalledTimes(2);
	});

	it('revokes an already-disabled account without changing its disabled state', async () => {
		const { auth } = setup({ disabled: true });
		await applyRegistrationReviewAuthDenylist(target, auth);
		expect(auth.updateUser).not.toHaveBeenCalled();
		expect(auth.revokeRefreshTokens).toHaveBeenCalledExactlyOnceWith(target.uid);
	});
});
