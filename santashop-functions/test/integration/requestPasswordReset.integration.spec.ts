import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import requestPasswordReset from '../../src/fn/requestPasswordReset';
import { createCallableRequest } from '../helpers/callable-context';
import {
	clearEmulatorData,
	getAuth,
	getDocument,
	getFirestore,
	seedAuthUser,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('requestPasswordReset integration', () => {
	beforeAll(() => {
		getFirestore();
		vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
		vi.stubEnv('SANTASHOP_SEND_EMAILS_FROM_EMULATOR', 'false');
	});

	beforeEach(async () => {
		await clearEmulatorData();
	});

	afterAll(async () => {
		await clearEmulatorData();
		vi.unstubAllEnvs();
	});

	it('creates one reset code for concurrent requests and stores no email or link', async () => {
		const emailAddress = 'password.reset.integration@example.com';
		const uid = 'password-reset-integration';
		await seedAuthUser({ uid, email: emailAddress });
		await setDocument('users', uid, { preferredLanguage: 'es' });
		const auth = getAuth();
		const generateResetLink = vi.spyOn(
			auth,
			'generatePasswordResetLink',
		);

		const responses = await Promise.all([
			requestPasswordReset(createCallableRequest({ emailAddress })),
			requestPasswordReset(
				createCallableRequest({ emailAddress: emailAddress.toUpperCase() }),
			),
		]);

		expect(responses).toEqual([
			{ accepted: true },
			{ accepted: true },
		]);
		expect(generateResetLink).toHaveBeenCalledTimes(1);
		expect(generateResetLink).toHaveBeenCalledWith(emailAddress, {
			url: 'http://localhost:4100/?mode=sign-in',
		});
		const rateLimitId = createHash('sha256')
			.update(emailAddress)
			.digest('hex');
		const storedClaim = await getDocument(
			'passwordResetRateLimits',
			rateLimitId,
		);
		expect(storedClaim).toMatchObject({
			lastRequestedAt: expect.anything(),
			expiresAt: expect.anything(),
		});
		expect(JSON.stringify(storedClaim)).not.toContain(emailAddress);
		expect(JSON.stringify(storedClaim)).not.toContain('oobCode');
	});

	it('returns the same accepted response when the account is missing', async () => {
		await expect(
			requestPasswordReset(
				createCallableRequest({
					emailAddress: 'missing.reset.integration@example.com',
				}),
			),
		).resolves.toEqual({ accepted: true });
	});
});
