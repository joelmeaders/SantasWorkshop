import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOnboardUser } from '../../fixtures/factories';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createFirebaseAdminMock,
	type FirebaseAdminMock,
} from '../../helpers/firebase-admin.mock';

const prepare = vi.fn();
const finalize = vi.fn();
const loadSubject = async (
	adminMock: FirebaseAdminMock,
): Promise<typeof import('../../../src/fn/newAccount')> => {
	vi.resetModules();
	vi.doMock('firebase-admin', () => adminMock.module);
	vi.doMock('../../../src/fn/accountProvisioning', () => ({
		prepareAccountProvisioning: prepare,
		finalizeAccountProvisioning: finalize,
	}));
	return import('../../../src/fn/newAccount');
};

describe('newAccount handler', () => {
	let adminMock: FirebaseAdminMock;
	beforeEach(() => {
		adminMock = createFirebaseAdminMock();
		const auth = adminMock.module.auth();
		adminMock.module.auth.mockReturnValue({
			...auth,
			getUserByEmail: vi
				.fn()
				.mockRejectedValue({ code: 'auth/user-not-found' }),
		});
		prepare.mockReset().mockResolvedValue('new-user-123');
		finalize.mockReset().mockResolvedValue(undefined);
		adminMock.createUser.mockResolvedValue({ uid: 'new-user-123' });
	});
	it.each([undefined, 'en', 'es'] as const)(
		'preserves accepted signup data and language %s without persisting a password',
		async (language) => {
			const input = createOnboardUser({ preferredLanguage: language });
			const { default: newAccount } = await loadSubject(adminMock);
			expect(await newAccount(createCallableRequest(input))).toBe(
				'new-user-123',
			);
			expect(prepare).toHaveBeenCalledWith(
				input.mutationId,
				expect.objectContaining({
					preferredLanguage: language ?? 'en',
					referredBy: input.referredBy,
				}),
			);
			expect(JSON.stringify(prepare.mock.calls)).not.toContain(
				input.password,
			);
			expect(adminMock.createUser).toHaveBeenCalledWith(
				expect.objectContaining({
					uid: 'new-user-123',
					password: input.password,
				}),
			);
			expect(finalize).toHaveBeenCalledWith('new-user-123');
		},
	);
	it('preserves the created identity when final setup fails', async () => {
		const { default: newAccount } = await loadSubject(adminMock);
		finalize.mockRejectedValue(
			new Error('Firestore or Storage unavailable'),
		);
		await expect(
			newAccount(createCallableRequest(createOnboardUser())),
		).rejects.toThrow('unavailable');
		expect(adminMock.deleteUser).not.toHaveBeenCalled();
		expect(adminMock.deleteFile).not.toHaveBeenCalled();
	});
	it('does not create Auth when saving the provisioning intent fails', async () => {
		const { default: newAccount } = await loadSubject(adminMock);
		prepare.mockRejectedValue(new Error('Intent write failed'));
		await expect(
			newAccount(createCallableRequest(createOnboardUser())),
		).rejects.toThrow('Intent write failed');
		expect(adminMock.createUser).not.toHaveBeenCalled();
	});
	it('maps duplicate Auth identities without finalizing them for an unauthenticated caller', async () => {
		const { default: newAccount } = await loadSubject(adminMock);
		adminMock.createUser.mockRejectedValue({
			code: 'auth/email-already-exists',
		});
		await expect(
			newAccount(createCallableRequest(createOnboardUser())),
		).rejects.toMatchObject({ code: 'already-exists' });
		expect(finalize).not.toHaveBeenCalled();
	});
	it('requires authentication before resuming setup and scopes recovery to the token UID', async () => {
		const { default: newAccount } = await loadSubject(adminMock);
		await expect(
			newAccount({ data: { resume: true } } as never),
		).rejects.toMatchObject({ code: 'unauthenticated' });
		await newAccount(
			createCallableRequest({ resume: true }, { uid: 'signed-in-owner' }),
		);
		expect(finalize).toHaveBeenCalledWith('signed-in-owner');
		expect(adminMock.createUser).not.toHaveBeenCalled();
	});
	it('rejects malformed onboarding requests with invalid-argument', async () => {
		const { default: newAccount } = await loadSubject(adminMock);

		await expect(
			newAccount(
				createCallableRequest({
					firstName: 'Buddy',
					lastName: 'Elf',
					emailAddress: 'not-an-email',
					password: 'CandyCane123!',
					password2: 'Mismatch123!',
					zipCode: '80205',
					legal: true,
					newsletter: true,
				} as never),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('rejects a missing referral before creating the auth user', async () => {
		const { default: newAccount } = await loadSubject(adminMock);

		await expect(
			newAccount(
				createCallableRequest(createOnboardUser({ referredBy: '  ' })),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		expect(adminMock.createUser).not.toHaveBeenCalled();
	});

	it('rejects oversized identity fields before creating the auth user', async () => {
		const { default: newAccount } = await loadSubject(adminMock);

		await expect(
			newAccount(
				createCallableRequest(
					createOnboardUser({ firstName: 'A'.repeat(101) }),
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		expect(adminMock.createUser).not.toHaveBeenCalled();
	});

	it('normalizes the Other referral answer before saving intent', async () => {
		const { default: newAccount } = await loadSubject(adminMock);
		await newAccount(
			createCallableRequest(
				createOnboardUser({ referredBy: ' Other:  Neighbor  ' }),
			),
		);
		expect(prepare).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ referredBy: 'Other:Neighbor' }),
		);
	});
	it('rejects an invalid Other referral answer before creating the auth user', async () => {
		const { default: newAccount } = await loadSubject(adminMock);

		await expect(
			newAccount(
				createCallableRequest(
					createOnboardUser({ referredBy: 'Other:ab' }),
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		expect(adminMock.createUser).not.toHaveBeenCalled();
	});

	it.each([
		' winter-pass-2026',
		'winter-pass-2026 ',
		' winter-pass-2026 ',
		'winter pass 2026',
		'a'.repeat(8),
		'a'.repeat(40),
	])('passes an exact raw password to Auth', async (password) => {
		adminMock.createUser.mockResolvedValue({ uid: 'raw-password-user' });
		adminMock.batchCommit.mockResolvedValue(undefined);
		const { default: newAccount } = await loadSubject(adminMock);
		await newAccount(
			createCallableRequest(
				createOnboardUser({ password, password2: password }),
			),
		);
		expect(adminMock.createUser).toHaveBeenCalledWith(
			expect.objectContaining({ password }),
		);
	});
	it.each([undefined, null, 123, {}, '', 'a'.repeat(7), 'a'.repeat(41)])(
		'rejects invalid raw passwords without side effects',
		async (password) => {
			const { default: newAccount } = await loadSubject(adminMock);
			await expect(
				newAccount(
					createCallableRequest(
						createOnboardUser({
							password,
							password2: password,
						} as never),
					),
				),
			).rejects.toMatchObject({ code: 'invalid-argument' });
			expect(adminMock.createUser).not.toHaveBeenCalled();
			expect(adminMock.batchCreate).not.toHaveBeenCalled();
		},
	);
	it.each([
		'winter-pass-2026',
		' winter-pass-2026',
		'winter-pass-2026 ',
		undefined,
		123,
	])(
		'rejects an inexact or invalid confirmation without side effects',
		async (password2) => {
			const { default: newAccount } = await loadSubject(adminMock);
			await expect(
				newAccount(
					createCallableRequest(
						createOnboardUser({
							password: ' winter-pass-2026 ',
							password2,
						} as never),
					),
				),
			).rejects.toMatchObject({ code: 'invalid-argument' });
			expect(adminMock.createUser).not.toHaveBeenCalled();
			expect(adminMock.batchCreate).not.toHaveBeenCalled();
		},
	);
});
