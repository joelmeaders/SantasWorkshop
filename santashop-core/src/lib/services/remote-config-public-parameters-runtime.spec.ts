import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultPublicParameters, PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY } from '@santashop/models';
import { FIREBASE_APP } from '../tokens';
import { PUBLIC_PARAMETERS_RUNTIME, provideRemoteConfigPublicParameters, type PublicParametersRuntime } from './remote-config-public-parameters.service';

const sdk = vi.hoisted(() => ({
	activate: vi.fn(), ensureInitialized: vi.fn(), fetchAndActivate: vi.fn(),
	getRemoteConfig: vi.fn(), getValue: vi.fn(), isSupported: vi.fn(), onConfigUpdate: vi.fn(),
}));
vi.mock('firebase/remote-config', () => sdk);

describe('Remote Config SDK adapter', () => {
	let runtime: PublicParametersRuntime;
	const remote = { settings: {} };
	beforeEach(() => {
		vi.resetAllMocks();
		sdk.isSupported.mockResolvedValue(true);
		sdk.getRemoteConfig.mockReturnValue(remote);
		sdk.ensureInitialized.mockResolvedValue(undefined);
		sdk.fetchAndActivate.mockResolvedValue(true);
		sdk.activate.mockResolvedValue(true);
		sdk.getValue.mockReturnValue({ getSource: (): string => 'remote', asString: (): string => JSON.stringify(createDefaultPublicParameters()) });
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

	it('activates real-time updates before delivering settings and preserves SDK unsubscribe', async () => {
		await runtime.initialize();
		const unsubscribe = vi.fn();
		sdk.onConfigUpdate.mockReturnValue(unsubscribe);
		const next = vi.fn();
		const error = vi.fn();
		expect(runtime.listen(next, error)).toBe(unsubscribe);
		const observer = sdk.onConfigUpdate.mock.calls[0]?.[1] as { next: () => void; error: (value: Error) => void; complete: () => void };
		let finish: () => void = (): void => undefined;
		sdk.activate.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
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
		sdk.getValue.mockReturnValue({ getSource: (): string => 'static', asString: (): string => '' });
		await expect(runtime.refresh()).rejects.toThrow('missing');
		sdk.getValue.mockReturnValue({ getSource: (): string => 'remote', asString: (): string => '{broken' });
		await expect(runtime.refresh()).rejects.toThrow();
	});
});
