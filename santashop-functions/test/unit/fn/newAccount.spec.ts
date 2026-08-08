import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { createOnboardUser } from '../../fixtures/factories';
import { createCallableRequest } from '../../helpers/callable-context';
import {
	createFirebaseAdminMock,
	type FirebaseAdminMock,
} from '../../helpers/firebase-admin.mock';

const generateQrCode = vi.fn();
const generateId = vi.fn();
const deleteQrCode = vi.fn();
const createQrCodeStoragePath = vi.fn();

const loadSubject = async (
	adminMock: FirebaseAdminMock,
): Promise<typeof import('../../../src/fn/newAccount')> => {
	vi.resetModules();

	vi.doMock('firebase-admin', () => adminMock.module);
	vi.doMock('../../../src/utility/qrcodes', () => ({
		generateQrCode,
		deleteQrCode,
		createQrCodeStoragePath,
	}));
	vi.doMock('../../../src/utility/id-generation', () => ({
		generateId,
	}));

	return import('../../../src/fn/newAccount');
};

describe('newAccount handler', () => {
	let adminMock: FirebaseAdminMock;

	beforeEach(() => {
		adminMock = createFirebaseAdminMock();
		generateQrCode.mockResolvedValue(undefined);
		deleteQrCode.mockResolvedValue(undefined);
		generateId.mockReturnValue('ABCD2345');
		createQrCodeStoragePath.mockImplementation(
			(uid: string) => `registrations/${uid}/test-asset.png`,
		);
	});

	it('creates auth, user, and registration records for a valid onboard request', async () => {
		const onboardUser = createOnboardUser();
		adminMock.createUser.mockResolvedValue({ uid: 'new-user-123' });
		adminMock.batchCommit.mockResolvedValue(undefined);

		const { default: newAccount } = await loadSubject(adminMock);

		const result = await newAccount(createCallableRequest(onboardUser));

		expect(result).toBe('new-user-123');
		expect(adminMock.createUser).toHaveBeenCalledWith({
			email: 'buddy.elf@example.com',
			password: onboardUser.password,
			disabled: false,
			displayName: 'Buddy Elf',
		});
		expect(adminMock.doc).toHaveBeenCalledWith('users/new-user-123');
		expect(adminMock.doc).toHaveBeenCalledWith(
			'registrations/new-user-123',
		);
		expect(adminMock.batchCreate).toHaveBeenCalledWith(
			expect.objectContaining({ path: 'users/new-user-123' }),
			expect.objectContaining({
				referredBy: 'Denver Human Services DHS',
			}),
		);
		expect(adminMock.batchCreate).toHaveBeenCalledTimes(2);
		expect(generateId).toHaveBeenCalledWith(8);
		expect(generateQrCode).toHaveBeenCalledWith(
			'registrations/new-user-123/test-asset.png',
			'ABCD2345',
		);
		expect(
			adminMock.getDocRef('registrations/new-user-123').set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				qrCodeGeneratedOn: expect.any(Date),
				qrCodeGenerationFailedOn: false,
			}),
			{ merge: true },
		);
	});

	it('maps auth creation failures to an HttpsError', async () => {
		const onboardUser = createOnboardUser();
		adminMock.createUser.mockRejectedValue({
			code: 'auth/email-already-exists',
			message: 'The email address is already in use by another account.',
		});

		const { default: newAccount } = await loadSubject(adminMock);

		await expect(
			newAccount(createCallableRequest(onboardUser)),
		).rejects.toSatisfy(
			(error: unknown) =>
				error instanceof HttpsError && error.code === 'already-exists',
		);
	});

	it('rolls back the auth user when firestore persistence fails', async () => {
		const onboardUser = createOnboardUser();
		adminMock.createUser.mockResolvedValue({ uid: 'new-user-rollback' });
		adminMock.batchCommit.mockRejectedValue(new Error('batch failed'));

		const { default: newAccount } = await loadSubject(adminMock);

		await expect(
			newAccount(createCallableRequest(onboardUser)),
		).rejects.toMatchObject({ code: 'internal' });
		expect(adminMock.deleteUser).toHaveBeenCalledWith('new-user-rollback');
	});

	it('rolls back persisted data when qr generation fails after persistence', async () => {
		const onboardUser = createOnboardUser();
		adminMock.createUser.mockResolvedValue({ uid: 'new-user-qr' });
		adminMock.batchCommit.mockResolvedValue(undefined);
		generateQrCode.mockRejectedValue(new Error('qr failed'));

		const { default: newAccount } = await loadSubject(adminMock);

		await expect(
			newAccount(createCallableRequest(onboardUser)),
		).rejects.toMatchObject({ code: 'internal' });
		expect(adminMock.deleteUser).toHaveBeenCalledWith('new-user-qr');
		expect(deleteQrCode).toHaveBeenCalledWith(
			'registrations/new-user-qr/test-asset.png',
		);
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
					zipCode: 80205,
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

	it('normalizes and validates Other referral answers before auth creation', async () => {
		const onboardUser = createOnboardUser({
			referredBy: ' Other:  Neighbor  ',
		});
		adminMock.createUser.mockResolvedValue({ uid: 'new-user-other' });
		adminMock.batchCommit.mockResolvedValue(undefined);

		const { default: newAccount } = await loadSubject(adminMock);

		await newAccount(createCallableRequest(onboardUser));

		expect(adminMock.batchCreate).toHaveBeenCalledWith(
			expect.objectContaining({ path: 'users/new-user-other' }),
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
});
