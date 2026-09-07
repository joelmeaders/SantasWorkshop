import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createDefaultPublicParameters,
	PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY,
} from '../../../src/models';
import { createCallableRequest } from '../../helpers/callable-context';
const mocks = vi.hoisted(() => ({
	getTemplate: vi.fn(),
	validateTemplate: vi.fn(),
	publishTemplate: vi.fn(),
}));
vi.mock('firebase-admin/remote-config', () => ({
	getRemoteConfig: () => mocks,
}));
import {
	PublicParametersCache,
	isLocalPublicParameters,
	settingsFromTemplate,
} from '../../../src/utility/public-parameters';
import {
	readPublicParametersSettings,
	publishPublicParametersSettings,
} from '../../../src/fn/publicParametersSettings';
import admin from '../../../src/firebase-admin';
import type { RemoteConfigTemplate } from 'firebase-admin/remote-config';
const template = (): RemoteConfigTemplate => ({
	etag: 'etag-1',
	version: { versionNumber: '1' },
	conditions: [],
	parameters: { other: { defaultValue: { value: 'keep' } } },
	parameterGroups: {
		controls: {
			parameters: {
				[PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY]: {
					valueType: 'JSON',
					defaultValue: {
						value: JSON.stringify(createDefaultPublicParameters()),
					},
				},
			},
		},
	},
});
const ownerRequest = (
	data: unknown,
): ReturnType<typeof createCallableRequest> =>
	createCallableRequest(data, { uid: 'owner', owner: true });
const settle = async (): Promise<void> => {
	await new Promise((resolve) => setTimeout(resolve, 0));
};
describe('Remote Config backend', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.useRealTimers();
	});
	beforeEach(() => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
		vi.spyOn(admin, 'remoteConfig').mockReturnValue(mocks as never);
		mocks.getTemplate.mockResolvedValue(template());
		mocks.validateTemplate.mockImplementation(async (value) => value);
		mocks.publishTemplate.mockImplementation(async (value) => ({
			...value,
			etag: 'etag-2',
			version: { versionNumber: '2' },
		}));
	});
	it('serves defaults cold, deduplicates requests, refreshes stale cache and retains valid data on failure', async () => {
		let now = 0;
		const changed = {
			...createDefaultPublicParameters(),
			maintenanceModeEnabled: true,
		};
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(changed)
			.mockRejectedValue(new Error('offline'));
		const cache = new PublicParametersCache(fetch, () => now);
		expect(cache.read()).toEqual(createDefaultPublicParameters());
		cache.read();
		await Promise.resolve();
		expect(fetch).toHaveBeenCalledTimes(1);
		await settle();
		expect(cache.read()).toEqual(changed);
		now = 10_000;
		expect(cache.read()).toEqual(changed);
		await settle();
		now = 19_999;
		cache.read();
		expect(fetch).toHaveBeenCalledTimes(2);
		now = 20_000;
		cache.read();
		await settle();
		expect(fetch).toHaveBeenCalledTimes(3);
		now = 49_999;
		cache.read();
		expect(fetch).toHaveBeenCalledTimes(3);
		now = 50_000;
		cache.read();
		await settle();
		expect(fetch).toHaveBeenCalledTimes(4);
	});
	it('retains defaults for invalid settings and caps retry delay at five minutes', async () => {
		let now = 0;
		const fetch = vi.fn().mockResolvedValue({});
		const cache = new PublicParametersCache(fetch, () => now);
		for (const time of [0, 10000, 40000, 100000, 400000]) {
			now = time;
			expect(cache.read()).toEqual(createDefaultPublicParameters());
			await settle();
		}
		expect(fetch).toHaveBeenCalledTimes(5);
		now = 699999;
		cache.read();
		expect(fetch).toHaveBeenCalledTimes(5);
		now = 700000;
		cache.read();
		await settle();
		expect(fetch).toHaveBeenCalledTimes(6);
	});
	it('requires both emulator markers before selecting the local adapter', () => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
		vi.stubEnv('FIRESTORE_EMULATOR_HOST', '');
		expect(() => isLocalPublicParameters()).toThrow('host');
		vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
		expect(isLocalPublicParameters()).toBe(true);
		expect(mocks.getTemplate).not.toHaveBeenCalled();
	});
	it('bounds a hung refresh and ignores its late completion after a successful retry', async () => {
		vi.useFakeTimers();
		let finish:
			| ((
					value: ReturnType<typeof createDefaultPublicParameters>,
			  ) => void)
			| undefined;
		const late = new Promise<
			ReturnType<typeof createDefaultPublicParameters>
		>((resolve) => {
			finish = resolve;
		});
		const updated = {
			...createDefaultPublicParameters(),
			maintenanceModeEnabled: true,
		};
		const fetch = vi
			.fn()
			.mockReturnValueOnce(late)
			.mockResolvedValue(updated);
		const cache = new PublicParametersCache(fetch);
		cache.read();
		await vi.advanceTimersByTimeAsync(10000);
		await vi.advanceTimersByTimeAsync(10000);
		cache.read();
		await vi.advanceTimersByTimeAsync(0);
		expect(cache.read()).toEqual(updated);
		expect(fetch).toHaveBeenCalledTimes(2);
		finish!(createDefaultPublicParameters());
		await vi.advanceTimersByTimeAsync(0);
		expect(cache.read()).toEqual(updated);
	});
	it('requires JSON type and exactly one parameter across groups', () => {
		const config = template();
		const parameter =
			config.parameterGroups!['controls'].parameters[
				PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY
			];
		parameter.valueType = 'STRING';
		expect(() => settingsFromTemplate(config)).toThrow('JSON value type');
		parameter.valueType = 'JSON';
		config.parameters[PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY] = parameter;
		expect(() => settingsFromTemplate(config)).toThrow('exactly once');
	});
	it('rejects targeted and missing settings', () => {
		const config = template();
		config.parameterGroups!['controls'].parameters[
			PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY
		].conditionalValues = { experiment: { value: '{}' } };
		expect(() => settingsFromTemplate(config)).toThrow('unconditional');
		expect(() =>
			settingsFromTemplate({ etag: 'x', conditions: [], parameters: {} }),
		).toThrow('exactly once');
	});
	it('denies unauthenticated and non-owner requests before fetching', async () => {
		await expect(
			readPublicParametersSettings({
				...createCallableRequest({}),
				auth: undefined,
			}),
		).rejects.toMatchObject({ code: 'unauthenticated' });
		await expect(
			publishPublicParametersSettings(
				createCallableRequest({}, { uid: 'staff', roles: ['admin'] }),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
		expect(mocks.getTemplate).not.toHaveBeenCalled();
	});
	it('returns version and ETag and preserves unrelated parameters and groups while publishing', async () => {
		expect(
			await readPublicParametersSettings(ownerRequest({})),
		).toMatchObject({ etag: 'etag-1', version: '1' });
		const result = await publishPublicParametersSettings(
			ownerRequest({
				expectedEtag: 'etag-1',
				settings: {
					...createDefaultPublicParameters(),
					maintenanceModeEnabled: true,
				},
			}),
		);
		expect(result).toMatchObject({
			etag: 'etag-2',
			version: '2',
			settings: { maintenanceModeEnabled: true },
		});
		expect(
			mocks.publishTemplate.mock.calls[0][0].parameters.other.defaultValue
				.value,
		).toBe('keep');
		expect(mocks.publishTemplate.mock.calls[0]).toHaveLength(1);
	});
	it('rejects conflicts, malformed values and failed publications', async () => {
		await expect(
			publishPublicParametersSettings(
				ownerRequest({
					expectedEtag: 'old',
					settings: createDefaultPublicParameters(),
				}),
			),
		).rejects.toMatchObject({ code: 'aborted' });
		await expect(
			publishPublicParametersSettings(
				ownerRequest({ expectedEtag: 'etag-1', settings: {} }),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		mocks.publishTemplate.mockRejectedValue({
			code: 'remote-config/aborted',
		});
		await expect(
			publishPublicParametersSettings(
				ownerRequest({
					expectedEtag: 'etag-1',
					settings: createDefaultPublicParameters(),
				}),
			),
		).rejects.toMatchObject({ code: 'aborted' });
		mocks.publishTemplate.mockRejectedValue(new Error('offline'));
		await expect(
			publishPublicParametersSettings(
				ownerRequest({
					expectedEtag: 'etag-1',
					settings: createDefaultPublicParameters(),
				}),
			),
		).rejects.toMatchObject({ code: 'unavailable' });
	});
});
