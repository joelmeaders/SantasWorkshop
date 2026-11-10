import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultPublicParameters } from '../../../src/models';

const mocks = vi.hoisted(() => ({
	getIdTokenClient: vi.fn(),
	fetchIdToken: vi.fn(),
	fetcher: vi.fn(),
	getFixture: vi.fn(),
	doc: vi.fn(),
}));
vi.mock('google-auth-library', () => ({
	GoogleAuth: class {
		public getIdTokenClient = mocks.getIdTokenClient;
	},
}));
vi.mock('../../../src/firebase-admin', () => ({
	default: { firestore: () => ({ doc: mocks.doc }) },
}));
import {
	createMutationPublicParametersReader,
	getPublicParametersForMutation,
	PUBLIC_PARAMETERS_GATEWAY_URL_ENV,
} from '../../../src/utility/public-parameters';

const openSettings = (): ReturnType<typeof createDefaultPublicParameters> => ({
	...createDefaultPublicParameters(),
	createAccountEnabled: true,
	registrationEnabled: true,
	maintenanceModeEnabled: false,
	weatherModeEnabled: false,
	admin: {
		...createDefaultPublicParameters().admin,
		preRegistrationEnabled: true,
	},
});
const envelope = (settings = openSettings(), source = 'fresh'): object => ({
	settings,
	source,
	lastFreshAt: Date.now(),
});
const response = (body: unknown, ok = true): object => ({
	ok,
	status: ok ? 200 : 503,
	json: vi.fn().mockResolvedValue(body),
});

describe('authoritative mutation settings', () => {
	beforeEach(() => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
		vi.stubEnv(
			PUBLIC_PARAMETERS_GATEWAY_URL_ENV,
			'https://publicparametersgateway-example-uc.a.run.app',
		);
		vi.stubGlobal('fetch', mocks.fetcher);
		mocks.getIdTokenClient.mockResolvedValue({
			idTokenProvider: { fetchIdToken: mocks.fetchIdToken },
		});
		mocks.fetchIdToken.mockResolvedValue('test-id-token');
		mocks.fetcher.mockResolvedValue(response(envelope()));
		mocks.doc.mockReturnValue({ get: mocks.getFixture });
		mocks.getFixture.mockResolvedValue({
			exists: true,
			data: openSettings,
		});
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it('waits for the first fresh cloud read instead of returning build defaults', async () => {
		let finish!: (value: unknown) => void;
		mocks.fetcher.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			}),
		);
		let settled = false;
		const pending = getPublicParametersForMutation().then((settings) => {
			settled = true;
			return settings;
		});
		await vi.waitFor(() => expect(mocks.fetcher).toHaveBeenCalledOnce());
		expect(settled).toBe(false);
		finish(response(envelope()));
		await expect(pending).resolves.toEqual(openSettings());
	});

	it('observes a fresh closure on the next operation without retaining open settings', async () => {
		const closed = {
			...openSettings(),
			createAccountEnabled: false,
			registrationEnabled: false,
			maintenanceModeEnabled: true,
		};
		mocks.fetcher
			.mockResolvedValueOnce(response(envelope()))
			.mockResolvedValueOnce(response(envelope(closed)));
		await expect(getPublicParametersForMutation()).resolves.toEqual(
			openSettings(),
		);
		await expect(getPublicParametersForMutation()).resolves.toEqual(closed);
		expect(mocks.fetcher).toHaveBeenCalledTimes(2);
	});

	it('rejects stale open settings even after an earlier successful read', async () => {
		mocks.fetcher
			.mockResolvedValueOnce(response(envelope()))
			.mockResolvedValueOnce(response(envelope(openSettings(), 'stale')));
		await getPublicParametersForMutation();
		await expect(getPublicParametersForMutation()).rejects.toMatchObject({
			code: 'unavailable',
		});
	});

	it.each([
		undefined,
		{ source: 'fresh', lastFreshAt: 1 },
		{ settings: {}, source: 'fresh', lastFreshAt: 1 },
		{ settings: openSettings(), source: 'unknown', lastFreshAt: 1 },
		{ settings: openSettings(), source: 'fresh', lastFreshAt: '1' },
	])('rejects missing or malformed gateway data: %j', async (body) => {
		mocks.fetcher.mockResolvedValue(response(body));
		await expect(getPublicParametersForMutation()).rejects.toMatchObject({
			code: 'unavailable',
		});
	});

	it('fails closed on a gateway HTTP error without retrying', async () => {
		mocks.fetcher.mockResolvedValue(response({}, false));
		await expect(getPublicParametersForMutation()).rejects.toMatchObject({
			code: 'unavailable',
		});
		expect(mocks.fetcher).toHaveBeenCalledOnce();
	});

	it.each(['client', 'token', 'fetch', 'body'] as const)(
		'bounds a hung %s stage, including authentication and body parsing',
		async (stage) => {
			vi.useFakeTimers();
			const hung = new Promise<never>(() => undefined);
			if (stage === 'client')
				mocks.getIdTokenClient.mockReturnValue(hung);
			if (stage === 'token') mocks.fetchIdToken.mockReturnValue(hung);
			if (stage === 'fetch') mocks.fetcher.mockReturnValue(hung);
			if (stage === 'body')
				mocks.fetcher.mockResolvedValue({
					ok: true,
					json: () => hung,
				});
			const outcome = getPublicParametersForMutation().catch(
				(error: unknown) => error,
			);
			await vi.advanceTimersByTimeAsync(10_000);
			await expect(outcome).resolves.toMatchObject({
				code: 'unavailable',
			});
			expect(vi.getTimerCount()).toBe(0);
		},
	);

	it('does not let a late open response replace a later fresh closure', async () => {
		vi.useFakeTimers();
		let finish!: (value: unknown) => void;
		mocks.fetcher.mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve;
			}),
		);
		const first = getPublicParametersForMutation().catch(
			(error: unknown) => error,
		);
		await vi.advanceTimersByTimeAsync(10_000);
		await expect(first).resolves.toMatchObject({ code: 'unavailable' });
		const closed = { ...openSettings(), createAccountEnabled: false };
		mocks.fetcher.mockResolvedValue(response(envelope(closed)));
		await expect(getPublicParametersForMutation()).resolves.toEqual(closed);
		finish(response(envelope()));
		await vi.advanceTimersByTimeAsync(0);
		await expect(getPublicParametersForMutation()).resolves.toEqual(closed);
	});

	it('uses the authoritative emulator fixture without contacting the cloud', async () => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
		vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
		await expect(getPublicParametersForMutation()).resolves.toEqual(
			openSettings(),
		);
		expect(mocks.doc).toHaveBeenCalledWith('_testConfig/publicParameters');
		expect(mocks.fetcher).not.toHaveBeenCalled();
	});

	it.each([
		{ exists: false, data: () => undefined },
		{ exists: true, data: () => ({}) },
	])(
		'rejects missing or malformed emulator settings rather than defaults',
		async (snapshot) => {
			vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
			vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
			mocks.getFixture.mockResolvedValue(snapshot);
			await expect(
				getPublicParametersForMutation(),
			).rejects.toMatchObject({ code: 'unavailable' });
			expect(mocks.fetcher).not.toHaveBeenCalled();
		},
	);

	it('requires the Firestore emulator marker before any local read', async () => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
		vi.stubEnv('FIRESTORE_EMULATOR_HOST', '');
		await expect(getPublicParametersForMutation()).rejects.toMatchObject({
			code: 'unavailable',
		});
		expect(mocks.getFixture).not.toHaveBeenCalled();
		expect(mocks.fetcher).not.toHaveBeenCalled();
	});

	it('bounds an unresponsive emulator read', async () => {
		vi.useFakeTimers();
		vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
		vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
		mocks.getFixture.mockReturnValue(new Promise<never>(() => undefined));
		const outcome = getPublicParametersForMutation().catch(
			(error: unknown) => error,
		);
		await vi.advanceTimersByTimeAsync(10_000);
		await expect(outcome).resolves.toMatchObject({ code: 'unavailable' });
	});

	it('lazily shares one read only within a single mutation invocation', async () => {
		const read = createMutationPublicParametersReader();
		expect(mocks.fetcher).not.toHaveBeenCalled();
		const first = read();
		expect(read()).toBe(first);
		await expect(first).resolves.toEqual(openSettings());
		await read();
		expect(mocks.fetcher).toHaveBeenCalledOnce();
		await createMutationPublicParametersReader()();
		expect(mocks.fetcher).toHaveBeenCalledTimes(2);
	});

	it('keeps a failed invocation failed instead of retrying within a transaction', async () => {
		mocks.fetcher.mockRejectedValue(new Error('offline'));
		const read = createMutationPublicParametersReader();
		await expect(read()).rejects.toMatchObject({ code: 'unavailable' });
		await expect(read()).rejects.toMatchObject({ code: 'unavailable' });
		expect(mocks.fetcher).toHaveBeenCalledOnce();
	});
});
