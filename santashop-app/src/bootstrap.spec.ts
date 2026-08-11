import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationRef, Type } from '@angular/core';
import {
	FIREBASE_FIRESTORE,
	PUBLIC_PARAMETERS_SOURCE,
} from '@santashop/core';
import { LitePublicParametersSource } from './app/core/services/lite-public-parameters-source.service';
import { FIREBASE_FIRESTORE_LITE } from './app/core/tokens/customer-runtime.token';
import {
	bootstrapCustomerApplication,
	BootstrapApplication,
	CustomerAppConfig,
	FirebaseBootstrapDependencies,
	startCustomerApplication,
} from './bootstrap';

const appConfig: CustomerAppConfig = {
	production: false,
	appCheckEnabled: false,
	appCheckKey: 'app-check-key',
	programYear: 2026,
	shopDays: [12, 13],
	emulatorPorts: { auth: 9099, functions: 5001, firestore: 8080, storage: 9199 },
};

const createFirebaseDependencies = (): {
	dependencies: FirebaseBootstrapDependencies;
	mocks: Record<string, ReturnType<typeof vi.fn>>;
} => {
	const firebaseApp = { name: 'firebase-app' };
	const auth = { name: 'auth' };
	const storage = { name: 'storage' };
	const functions = { name: 'functions' };
	const firestore = { name: 'firestore' };
	const analytics = { name: 'analytics' };
	const mocks = {
		initializeApp: vi.fn(() => firebaseApp),
		initializeAppCheck: vi.fn(),
		ReCaptchaEnterpriseProvider: vi.fn(),
		getAuth: vi.fn(() => auth),
		connectAuthEmulator: vi.fn(),
		getStorage: vi.fn(() => storage),
		connectStorageEmulator: vi.fn(),
		getFunctions: vi.fn(() => functions),
		connectFunctionsEmulator: vi.fn(),
		getFirestoreLite: vi.fn(() => firestore),
		connectFirestoreLiteEmulator: vi.fn(),
		getAnalytics: vi.fn(() => analytics),
	};

	return { dependencies: mocks as unknown as FirebaseBootstrapDependencies, mocks };
};

const application = {
	rootComponent: class TestAppComponent {} as Type<unknown>,
	routes: [],
};

describe('bootstrapCustomerApplication', () => {
	afterEach(() => {
		delete (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
			.FIREBASE_APPCHECK_DEBUG_TOKEN;
	});

	it('connects every local Firebase emulator before bootstrapping', async (): Promise<void> => {
		const { dependencies, mocks } = createFirebaseDependencies();
		const appRef = {} as ApplicationRef;
		const bootstrap = vi.fn<BootstrapApplication>().mockResolvedValue(appRef);

		await expect(
			bootstrapCustomerApplication(
				appConfig,
				{ projectId: 'demo-santashop' },
				dependencies,
				application,
				bootstrap,
			),
		).resolves.toBe(appRef);

		expect(mocks['connectAuthEmulator']).toHaveBeenCalledWith(
			{ name: 'auth' },
			'http://127.0.0.1:9099',
			{ disableWarnings: true },
		);
		expect(mocks['connectStorageEmulator']).toHaveBeenCalledWith(
			{ name: 'storage' },
			'127.0.0.1',
			9199,
		);
		expect(mocks['connectFunctionsEmulator']).toHaveBeenCalledWith(
			{ name: 'functions' },
			'127.0.0.1',
			5001,
		);
		expect(mocks['connectFirestoreLiteEmulator']).toHaveBeenCalledWith(
			{ name: 'firestore' },
			'127.0.0.1',
			8080,
		);
		expect(mocks['getFunctions']).toHaveBeenCalledWith(
			{ name: 'firebase-app' },
			'us-central1',
		);
		expect(mocks['getAnalytics']).not.toHaveBeenCalled();
		const options = bootstrap.mock.calls[0]![1];
		expect(options.providers).toEqual(
			expect.arrayContaining([
				LitePublicParametersSource,
				expect.objectContaining({
					provide: FIREBASE_FIRESTORE_LITE,
					useValue: { name: 'firestore' },
				}),
				expect.objectContaining({
					provide: PUBLIC_PARAMETERS_SOURCE,
					useExisting: LitePublicParametersSource,
				}),
			]),
		);
		expect(options.providers).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ provide: FIREBASE_FIRESTORE }),
			]),
		);
	});

	it('enables App Check debugging locally and configures the production-only services', async (): Promise<void> => {
		const { dependencies, mocks } = createFirebaseDependencies();
		const bootstrap = vi.fn<BootstrapApplication>().mockResolvedValue(
			{} as ApplicationRef,
		);
		const enableProductionMode = vi.fn();

		await bootstrapCustomerApplication(
			{ ...appConfig, appCheckEnabled: true },
			{},
			dependencies,
			application,
			bootstrap,
			enableProductionMode,
		);
		expect((self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
			.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true);
		expect(mocks['initializeAppCheck']).toHaveBeenCalledOnce();
		expect(enableProductionMode).not.toHaveBeenCalled();

		delete (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
			.FIREBASE_APPCHECK_DEBUG_TOKEN;
		await bootstrapCustomerApplication(
			{ ...appConfig, appCheckEnabled: true, production: true },
			{},
			dependencies,
			application,
			bootstrap,
			enableProductionMode,
		);

		expect((self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
			.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
		expect(mocks['getFunctions']).toHaveBeenLastCalledWith(
			{ name: 'firebase-app' },
			location.origin,
		);
		expect(mocks['getAnalytics']).toHaveBeenCalledWith({ name: 'firebase-app' });
		expect(enableProductionMode).toHaveBeenCalledOnce();
		expect(mocks['connectAuthEmulator']).toHaveBeenCalledTimes(1);
	});

	it('reports bootstrap rejection without leaving an unhandled promise', async (): Promise<void> => {
		const error = new Error('bootstrap failed');
		const logError = vi.fn();

		startCustomerApplication(
			vi.fn<() => Promise<ApplicationRef>>().mockRejectedValue(error),
			logError,
		);

		await vi.waitFor(() => expect(logError).toHaveBeenCalledWith(error));
	});
});
