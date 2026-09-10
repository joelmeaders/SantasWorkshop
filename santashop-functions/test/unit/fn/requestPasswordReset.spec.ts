import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

const sesSend = vi.fn();
const emailSendingEnabled = vi.fn();
const logDebug = vi.fn();
const logInfo = vi.fn();
const logWarn = vi.fn();
const logError = vi.fn();

const loadSubject = async (
	adminMock: ReturnType<typeof createBackgroundAdminMock>,
): Promise<typeof import('../../../src/fn/requestPasswordReset')> => {
	vi.resetModules();
	emailSendingEnabled.mockReset().mockResolvedValue(true);
	vi.doMock('../../../src/utility/email-sending', () => ({
		isEmailSendingEnabled: emailSendingEnabled,
	}));
	vi.doMock('firebase-admin', () => adminMock.module);
	vi.doMock('@aws-sdk/client-ses', () => ({
		SESClient: class {
			public send = sesSend;
		},
		SendEmailCommand: class {
			constructor(public readonly input: unknown) {}
		},
	}));
	vi.doMock('../../../src/utility/observability', () => ({
		createFunctionLogger: () => ({
			debug: logDebug,
			info: logInfo,
			warn: logWarn,
			error: logError,
		}),
	}));
	return import('../../../src/fn/requestPasswordReset');
};

describe('requestPasswordReset handler', () => {
	let adminMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		adminMock = createBackgroundAdminMock();
		sesSend.mockReset().mockResolvedValue({ MessageId: 'ses-message' });
		logDebug.mockReset();
		logInfo.mockReset();
		logWarn.mockReset();
		logError.mockReset();
		vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
		vi.stubEnv('SANTASHOP_SEND_EMAILS_FROM_EMULATOR', 'false');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('normalizes the email, reserves a hash-only claim, and sends Spanish content', async () => {
		const normalizedEmail = 'parent@example.com';
		const emailHash = createHash('sha256')
			.update(normalizedEmail)
			.digest('hex');
		adminMock.getUserByEmail.mockResolvedValue({ uid: 'user-1' });
		adminMock.generatePasswordResetLink.mockResolvedValue(
			'https://auth.example/reset?oobCode=secret-code&mode=resetPassword',
		);
		adminMock.setDocSnapshot('users/user-1', { preferredLanguage: 'es' });
		const { default: requestPasswordReset } = await loadSubject(adminMock);

		const response = await requestPasswordReset(
			createCallableRequest({ emailAddress: '  Parent@Example.COM  ' }),
		);

		expect(response).toEqual({ accepted: true });
		expect(adminMock.doc).toHaveBeenCalledWith(
			`passwordResetRateLimits/${emailHash}`,
		);
		expect(adminMock.transactionSet).toHaveBeenCalledWith(
			expect.objectContaining({
				path: `passwordResetRateLimits/${emailHash}`,
			}),
			expect.objectContaining({
				lastRequestedAt: expect.any(Date),
				expiresAt: expect.any(Date),
			}),
		);
		const persisted = adminMock.transactionSet.mock.calls[0]?.[1];
		expect(JSON.stringify(persisted)).not.toContain(normalizedEmail);
		expect(JSON.stringify(persisted)).not.toContain('secret-code');
		expect(adminMock.getUserByEmail).toHaveBeenCalledWith(normalizedEmail);
		expect(adminMock.generatePasswordResetLink).toHaveBeenCalledWith(
			normalizedEmail,
			{
				url: 'http://localhost:4100/?mode=sign-in',
			},
		);
		expect(sesSend).toHaveBeenCalledOnce();
		const command = sesSend.mock.calls[0]?.[0] as {
			input: Record<string, any>;
		};
		expect(command.input).toMatchObject({
			Destination: { ToAddresses: [normalizedEmail] },
			Source: 'noreply@denversantaclausshop.org',
			ReturnPath: 'admin@denversantaclausshop.org',
		});
		expect(command.input.Message.Subject.Data).toContain('Restablece');
		expect(command.input.Message.Body.Text.Data).toContain('secret-code');
		expect(command.input.Message.Body.Html.Data).toContain(
			'oobCode=secret-code&amp;mode=resetPassword',
		);
		const logs = JSON.stringify([
			logDebug.mock.calls,
			logInfo.mock.calls,
			logWarn.mock.calls,
			logError.mock.calls,
		]);
		expect(logs).not.toContain(normalizedEmail);
		expect(logs).not.toContain('secret-code');
	});

	it('rejects invalid input before it reserves a rate-limit claim', async () => {
		const { default: requestPasswordReset } = await loadSubject(adminMock);

		await expect(
			requestPasswordReset(
				createCallableRequest({ emailAddress: 'not-an-email' }),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		expect(adminMock.runTransaction).not.toHaveBeenCalled();
		expect(adminMock.getUserByEmail).not.toHaveBeenCalled();
	});

	it('returns the same accepted response for a missing account', async () => {
		adminMock.getUserByEmail.mockRejectedValue({
			code: 'auth/user-not-found',
		});
		const { default: requestPasswordReset } = await loadSubject(adminMock);

		await expect(
			requestPasswordReset(
				createCallableRequest({ emailAddress: 'missing@example.com' }),
			),
		).resolves.toEqual({ accepted: true });
		expect(adminMock.generatePasswordResetLink).not.toHaveBeenCalled();
		expect(sesSend).not.toHaveBeenCalled();
	});

	it('returns accepted without provider work during the minimum interval', async () => {
		const email = 'limited@example.com';
		const emailHash = createHash('sha256').update(email).digest('hex');
		adminMock.setDocSnapshot(`passwordResetRateLimits/${emailHash}`, {
			lastRequestedAt: new Date(),
		});
		const { default: requestPasswordReset } = await loadSubject(adminMock);

		await expect(
			requestPasswordReset(
				createCallableRequest({ emailAddress: email }),
			),
		).resolves.toEqual({ accepted: true });
		expect(adminMock.transactionSet).not.toHaveBeenCalled();
		expect(adminMock.getUserByEmail).not.toHaveBeenCalled();
	});

	it('returns accepted when SES rejects the delivery request', async () => {
		adminMock.getUserByEmail.mockResolvedValue({ uid: 'user-2' });
		adminMock.generatePasswordResetLink.mockResolvedValue(
			'https://auth.example/reset?oobCode=one-time-code',
		);
		adminMock.setDocSnapshot('users/user-2', {
			preferredLanguage: 'unknown',
		});
		sesSend.mockRejectedValue({ code: 'MessageRejected' });
		const { default: requestPasswordReset } = await loadSubject(adminMock);

		await expect(
			requestPasswordReset(
				createCallableRequest({ emailAddress: 'parent@example.com' }),
			),
		).resolves.toEqual({ accepted: true });
	});

	it('creates an Auth emulator reset code but suppresses SES by default', async () => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
		adminMock.getUserByEmail.mockResolvedValue({ uid: 'user-3' });
		adminMock.generatePasswordResetLink.mockResolvedValue(
			'http://127.0.0.1:9099/emulator/action?oobCode=emulator-code',
		);
		const { default: requestPasswordReset } = await loadSubject(adminMock);

		await expect(
			requestPasswordReset(
				createCallableRequest({ emailAddress: 'emulator@example.com' }),
			),
		).resolves.toEqual({ accepted: true });
		expect(adminMock.generatePasswordResetLink).toHaveBeenCalledOnce();
		expect(sesSend).not.toHaveBeenCalled();
	});

	it('allows an explicit emulator SES integration run', async () => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
		vi.stubEnv('SANTASHOP_SEND_EMAILS_FROM_EMULATOR', 'true');
		adminMock.getUserByEmail.mockResolvedValue({ uid: 'user-4' });
		adminMock.generatePasswordResetLink.mockResolvedValue(
			'http://127.0.0.1:9099/emulator/action?oobCode=emulator-code',
		);
		const { default: requestPasswordReset } = await loadSubject(adminMock);

		await requestPasswordReset(
			createCallableRequest({ emailAddress: 'emulator@example.com' }),
		);

		expect(sesSend).toHaveBeenCalledOnce();
	});
});
