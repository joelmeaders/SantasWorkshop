import { createRequire } from 'node:module';
import type { RemoteConfigTemplate } from 'firebase-admin/remote-config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const key = 'santashop_email_sending_enabled';
const template = (value: string): RemoteConfigTemplate => ({
	etag: 'version-1',
	parameters: { [key]: { valueType: 'BOOLEAN', defaultValue: { value } } },
});
const requireFromTest = createRequire(import.meta.url);
const management = requireFromTest('../../../../scripts/email-sending.cjs') as {
	readEmailSending: (template: unknown) => boolean;
	prepareEmailSending: (
		template: unknown,
		enabled: boolean,
	) => Record<string, unknown>;
};

describe('email sending control', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.doUnmock('../../../src/utility/email-sending');
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
	});

	it('uses only an explicit unconditional boolean and supports parameter groups', async () => {
		const { emailSendingFromTemplate } =
			await import('../../../src/utility/email-sending');
		expect(emailSendingFromTemplate(template('true'))).toBe(true);
		expect(emailSendingFromTemplate(template('false'))).toBe(false);
		expect(
			emailSendingFromTemplate({
				etag: '1',
				parameters: {},
				parameterGroups: {
					email: { parameters: template('true').parameters },
				},
			}),
		).toBe(true);
		for (const invalid of [
			{ etag: '1', parameters: {} },
			template('TRUE'),
			template('yes'),
			{
				...template('true'),
				parameterGroups: {
					duplicate: { parameters: template('false').parameters },
				},
			},
			{
				parameters: {
					[key]: {
						valueType: 'STRING',
						defaultValue: { value: 'true' },
					},
				},
			},
			{
				parameters: {
					[key]: {
						...template('true').parameters[key],
						conditionalValues: { users: { value: 'false' } },
					},
				},
			},
		]) {
			expect(() =>
				emailSendingFromTemplate(invalid as RemoteConfigTemplate),
			).toThrow();
			expect(() => management.readEmailSending(invalid)).toThrow();
		}
	});

	it('caches permission for exactly three minutes and coalesces refreshes', async () => {
		const { EmailSendingCache } =
			await import('../../../src/utility/email-sending');
		let now = 100;
		const fetchSetting = vi
			.fn()
			.mockResolvedValueOnce(true)
			.mockResolvedValue(false);
		const cache = new EmailSendingCache(fetchSetting, () => now);
		expect(
			await Promise.all([cache.read(), cache.read(), cache.read()]),
		).toEqual([true, true, true]);
		expect(fetchSetting).toHaveBeenCalledTimes(1);
		now = 180_099;
		expect(await cache.read()).toBe(true);
		now = 180_100;
		expect(await Promise.all([cache.read(), cache.read()])).toEqual([
			false,
			false,
		]);
		expect(fetchSetting).toHaveBeenCalledTimes(2);
	});

	it('does not extend permission by the duration of a remote request', async () => {
		const { EmailSendingCache } =
			await import('../../../src/utility/email-sending');
		let now = 0;
		const fetchSetting = vi.fn(async () => {
			now += 5000;
			return true;
		});
		const cache = new EmailSendingCache(fetchSetting, () => now);
		expect(await cache.read()).toBe(true);
		now = 180_000;
		expect(await cache.read()).toBe(true);
		expect(fetchSetting).toHaveBeenCalledTimes(2);
	});

	it('blocks on cold-read failure, expired-read failure, and malformed results', async () => {
		const { EmailSendingCache } =
			await import('../../../src/utility/email-sending');
		let now = 0;
		const read = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(true)
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue('true');
		const cache = new EmailSendingCache(read, () => now);
		expect(await cache.read()).toBe(false);
		now = 180_000;
		expect(await cache.read()).toBe(true);
		now = 360_000;
		expect(await cache.read()).toBe(false);
		now = 540_000;
		expect(await cache.read()).toBe(false);
	});

	it('times out a stuck read and ignores a late allow response', async () => {
		const { EmailSendingCache } =
			await import('../../../src/utility/email-sending');
		vi.useFakeTimers();
		let resolveRead: (value: boolean) => void = () => undefined;
		const cache = new EmailSendingCache(
			() =>
				new Promise((resolve) => {
					resolveRead = resolve;
				}),
		);
		const pending = cache.read();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(await pending).toBe(false);
		resolveRead(true);
		await Promise.resolve();
		expect(await cache.read()).toBe(false);
	});

	it('reads the deployed project setting with authentication and rejects provider failures', async () => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
		vi.doMock('../../../src/firebase-admin', () => ({
			default: {
				app: () => ({
					options: {
						projectId: 'santas-workshop-test',
						credential: {
							getAccessToken: async () => ({
								access_token: 'test-token',
							}),
						},
					},
				}),
			},
		}));
		const { fetchEmailSendingEnabled } =
			await import('../../../src/utility/email-sending');
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify(template('true'))));
		expect(await fetchEmailSendingEnabled(fetcher)).toBe(true);
		expect(fetcher).toHaveBeenCalledWith(
			'https://firebaseremoteconfig.googleapis.com/v1/projects/santas-workshop-test/remoteConfig',
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: 'Bearer test-token',
				}),
				redirect: 'error',
			}),
		);
		fetcher.mockResolvedValue(new Response('{}', { status: 403 }));
		await expect(fetchEmailSendingEnabled(fetcher)).rejects.toThrow('403');
	});

	it('keeps emulator email disabled unless both the send opt-in and local setting allow it', async () => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
		vi.stubEnv('SANTASHOP_SEND_EMAILS_FROM_EMULATOR', undefined);
		const get = vi
			.fn()
			.mockResolvedValue({ data: () => ({ enabled: true }) });
		vi.doMock('../../../src/firebase-admin', () => ({
			default: { firestore: () => ({ doc: () => ({ get }) }) },
		}));
		const { fetchEmailSendingEnabled } =
			await import('../../../src/utility/email-sending');
		expect(await fetchEmailSendingEnabled()).toBe(false);
		expect(get).not.toHaveBeenCalled();
		vi.stubEnv('SANTASHOP_SEND_EMAILS_FROM_EMULATOR', 'true');
		expect(await fetchEmailSendingEnabled()).toBe(true);
		get.mockResolvedValue({ data: () => ({ enabled: false }) });
		expect(await fetchEmailSendingEnabled()).toBe(false);
		vi.stubEnv('FIRESTORE_EMULATOR_HOST', undefined);
		await expect(fetchEmailSendingEnabled()).rejects.toThrow(
			'verified Firestore emulator',
		);
	});

	it('adds or updates only the email control and preserves unrelated settings', () => {
		const original = {
			parameters: {
				unrelated: {
					valueType: 'STRING',
					defaultValue: { value: 'keep' },
				},
			},
			conditions: [{ name: 'existing', expression: 'true' }],
			version: { versionNumber: '12' },
		};
		const updated = management.prepareEmailSending(original, false);
		expect(management.readEmailSending(updated)).toBe(false);
		expect(updated).toMatchObject({
			parameters: { unrelated: original.parameters.unrelated },
			conditions: original.conditions,
		});
		expect(original.parameters).not.toHaveProperty(key);
		expect(
			management.readEmailSending(
				management.prepareEmailSending(updated, true),
			),
		).toBe(true);
	});
});
