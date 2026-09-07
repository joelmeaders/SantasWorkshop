import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultPublicParameters, PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY } from '@santashop/models';
import * as firebaseRemoteConfig from 'firebase/remote-config';
import { FIREBASE_APP } from '../tokens';
import { PUBLIC_PARAMETERS_RUNTIME, provideRemoteConfigPublicParameters, type PublicParametersRuntime } from './remote-config-public-parameters.service';

const sdk = vi.mocked(firebaseRemoteConfig);

describe('Remote Config SDK adapter', () => {
	let runtime: PublicParametersRuntime;
	const remote = { settings: {} } as firebaseRemoteConfig.RemoteConfig;
	const value = (text: string, source: firebaseRemoteConfig.ValueSource = 'remote'): firebaseRemoteConfig.Value => ({
		getSource: (): firebaseRemoteConfig.ValueSource => source,
		asString: (): string => text,
		asBoolean: (): boolean => false,
		asNumber: (): number => 0,
	});
	beforeEach(() => {
		vi.resetAllMocks();
		sdk.isSupported.mockResolvedValue(true);
		sdk.getRemoteConfig.mockReturnValue(remote);
		sdk.ensureInitialized.mockResolvedValue(undefined);
		sdk.fetchAndActivate.mockResolvedValue(true);
		sdk.activate.mockResolvedValue(true);
		sdk.getValue.mockReturnValue(value(JSON.stringify(createDefaultPublicParameters())));
		TestBed.configureTestingModule({ providers: [
			...provideRemoteConfigPublicParameters({ useEmulator: false }),
			{ provide: FIREBASE_APP, useValue: { name: 'test-app' } },
		] });
		runtime = TestBed.inject(PUBLIC_PARAMETERS_RUNTIME);
	});
	afterEach(() => TestBed.resetTestingModule());

	it('loads activated values before fetching and configures a one-minute fetch interval', async () => {
		await expect(runtime.initialize()).resolves.toEqual(createDefaultPublicParameters());
		expect(remote.settings).toEqual({ minimumFetchIntervalMillis: 60_000, fetchTimeoutMillis: 10_000 });
		expect(sdk.fetchAndActivate).not.toHaveBeenCalled();
		await expect(runtime.refresh()).resolves.toEqual(createDefaultPublicParameters());
		expect(sdk.fetchAndActivate).toHaveBeenCalledWith(remote);
		expect(sdk.getValue).toHaveBeenCalledWith(remote, PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY);
	});

	it('temporarily bypasses the SDK cache interval for forced scheduled fetches', async () => {
		await runtime.initialize();
		sdk.fetchAndActivate.mockImplementationOnce(async () => {
			expect(remote.settings.minimumFetchIntervalMillis).toBe(0);
			return true;
		});
		await expect(runtime.refresh(true)).resolves.toEqual(createDefaultPublicParameters());
		expect(remote.settings.minimumFetchIntervalMillis).toBe(60_000);

		sdk.fetchAndActivate.mockRejectedValueOnce(new Error('offline'));
		await expect(runtime.refresh(true)).rejects.toThrow('offline');
		expect(remote.settings.minimumFetchIntervalMillis).toBe(60_000);
	});

	it('activates real-time updates before delivering settings and preserves SDK unsubscribe', async () => {
		await runtime.initialize();
		const unsubscribe = vi.fn();
		sdk.onConfigUpdate.mockReturnValue(unsubscribe);
		const next = vi.fn();
		const error = vi.fn();
		expect(runtime.listen(next, error)).toBe(unsubscribe);
		const observer = sdk.onConfigUpdate.mock.calls[0]?.[1] as { next: () => void; error: (value: Error) => void; complete: () => void };
		let finish: () => void = (): void => undefined;
		sdk.activate.mockImplementation(() => new Promise<boolean>((resolve) => { finish = (): void => resolve(true); }));
		observer.next();
		expect(next).not.toHaveBeenCalled();
		finish();
		await Promise.resolve();
		await Promise.resolve();
		expect(next).toHaveBeenCalledWith(createDefaultPublicParameters());
		observer.complete();
		expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Real-time settings updates stopped.' }));
	});

	it('does not initialize Remote Config when browser support is unavailable', async () => {
		sdk.isSupported.mockResolvedValue(false);
		await expect(runtime.initialize()).rejects.toThrow('unsupported');
		expect(sdk.getRemoteConfig).not.toHaveBeenCalled();
		expect(sdk.ensureInitialized).not.toHaveBeenCalled();
		expect(sdk.fetchAndActivate).not.toHaveBeenCalled();
	});

	it('rejects missing remote values and malformed fetched configuration', async () => {
		await runtime.initialize();
		sdk.getValue.mockReturnValue(value('', 'static'));
		await expect(runtime.refresh()).rejects.toThrow('missing');
		sdk.getValue.mockReturnValue(value('{broken'));
		await expect(runtime.refresh()).rejects.toThrow();
	});
});
