import { TestBed } from '@angular/core/testing';
import { httpsCallable } from 'firebase/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	FIREBASE_ANALYTICS,
	FIREBASE_FIRESTORE,
	PUBLIC_PARAMETERS_RUNTIME,
	PROGRAM_YEAR,
	SHOP_DAYS,
} from '@santashop/core/admin';
import {
	bootstrapAdminApplication,
	type AdminBootstrapConfig,
	type AdminBootstrapDependencies,
	type AdminBootstrapOptions,
	getServiceWorkerScriptUrl,
} from './bootstrap-admin';
import { config } from './config';
import { requireDefined } from './test-helpers';

describe('admin bootstrap', () => {
	let dependencies: AdminBootstrapDependencies;
	let logger: (error: unknown) => void;

	beforeEach(() => {
		dependencies = createDependencies();
		logger = vi.fn() as unknown as (error: unknown) => void;
		delete (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
			.FIREBASE_APPCHECK_DEBUG_TOKEN;
	});

	it('wires local Firebase emulators and application settings before bootstrapping', async () => {
		await bootstrapAdminApplication({
			config: createConfig(),
			dependencies,
			firebaseConfig: createFirebaseConfig(),
			logger,
			origin: 'https://admin.example.test',
		});

		expect(dependencies.initializeApp).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: 'test-project' }),
		);
		expect(dependencies.connectAuthEmulator).toHaveBeenCalledWith(
			'auth',
			'http://127.0.0.1:9099',
			{ disableWarnings: true },
		);
		expect(dependencies.getFunctions).toHaveBeenCalledWith(
			'app',
			'us-central1',
		);
		expect(dependencies.connectFunctionsEmulator).toHaveBeenCalledWith(
			'functions',
			'127.0.0.1',
			5001,
		);
		expect(dependencies.getAnalytics).not.toHaveBeenCalled();
		expect(dependencies.enableProdMode).not.toHaveBeenCalled();
		const options = requireDefined(
			vi.mocked(dependencies.bootstrapApplication).mock.calls[0],
		)[1] as { providers: unknown[] };
		expect(options.providers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					provide: PROGRAM_YEAR,
					useValue: 2026,
				}),
				expect.objectContaining({
					provide: SHOP_DAYS,
					useValue: [12, 13, 15, 16],
				}),
			]),
		);
		const callable = vi
			.fn()
			.mockResolvedValue({ data: { local: 'fixture' } });
		vi.mocked(httpsCallable).mockReturnValue(
			callable as unknown as ReturnType<typeof httpsCallable>,
		);
		TestBed.configureTestingModule({
			providers: options.providers.filter(
				(provider) =>
					typeof provider === 'object' &&
					provider !== null &&
					'provide' in provider,
			) as never[],
		});
		const runtime = TestBed.inject(PUBLIC_PARAMETERS_RUNTIME);
		expect(runtime.local).toBe(true);
		await expect(runtime.refresh()).resolves.toEqual({ local: 'fixture' });
		expect(httpsCallable).toHaveBeenCalledWith(
			'functions',
			'testReadPublicParameters',
		);
		expect(options.providers).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ provide: FIREBASE_FIRESTORE }),
			]),
		);
	});

	it('uses production analytics, origin-based functions, and production mode', async () => {
		await bootstrapAdminApplication({
			config: createConfig({ appCheckEnabled: true, production: true }),
			dependencies,
			firebaseConfig: createFirebaseConfig(),
			logger,
			origin: 'https://admin.example.test',
		});

		expect(dependencies.initializeAppCheck).toHaveBeenCalledWith(
			'app',
			expect.objectContaining({ isTokenAutoRefreshEnabled: true }),
		);
		expect(dependencies.getFunctions).toHaveBeenCalledWith(
			'app',
			'https://admin.example.test',
		);
		expect(dependencies.connectAuthEmulator).not.toHaveBeenCalled();
		expect(dependencies.connectFunctionsEmulator).not.toHaveBeenCalled();
		expect(dependencies.enableProdMode).toHaveBeenCalledOnce();
		expect(dependencies.getAnalytics).toHaveBeenCalledWith('app');
		const options = requireDefined(
			vi.mocked(dependencies.bootstrapApplication).mock.calls[0],
		)[1] as { providers: unknown[] };
		expect(options.providers).toContainEqual(
			expect.objectContaining({
				provide: FIREBASE_ANALYTICS,
				useValue: 'analytics',
			}),
		);
		expect(
			(self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
				.FIREBASE_APPCHECK_DEBUG_TOKEN,
		).toBeUndefined();
	});

	it('keys the service-worker script URL to the configured release version', () => {
		expect(getServiceWorkerScriptUrl(config.version)).toBe(
			'ngsw-worker.js?v=2026.09.0-beta.4',
		);
		expect(getServiceWorkerScriptUrl('next-release')).not.toBe(
			getServiceWorkerScriptUrl(config.version),
		);
	});

	it('enables App Check debug mode for a configured local build', async () => {
		await bootstrapAdminApplication({
			config: createConfig({ appCheckEnabled: true }),
			dependencies,
			firebaseConfig: createFirebaseConfig(),
			logger,
			origin: 'https://admin.example.test',
		});

		expect(dependencies.initializeAppCheck).toHaveBeenCalledOnce();
		expect(
			(self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
				.FIREBASE_APPCHECK_DEBUG_TOKEN,
		).toBe(true);
	});

	it('logs bootstrap failures instead of leaving a rejected startup promise', async () => {
		const error = new Error('bootstrap failed');
		vi.mocked(dependencies.bootstrapApplication).mockRejectedValueOnce(
			error,
		);

		await bootstrapAdminApplication({
			config: createConfig(),
			dependencies,
			firebaseConfig: createFirebaseConfig(),
			logger,
			origin: 'https://admin.example.test',
		});

		expect(logger).toHaveBeenCalledWith(error);
	});
});

function createConfig(
	overrides: Partial<AdminBootstrapConfig> = {},
): AdminBootstrapConfig {
	return {
		appCheckEnabled: false,
		appCheckKey: 'app-check-key',
		emulatorPorts: {
			auth: 9099,
			functions: 5001,
			firestore: 8080,
			storage: 9199,
		},
		production: false,
		programYear: 2026,
		shopDays: [12, 13, 15, 16],
		...overrides,
	};
}

function createFirebaseConfig(): AdminBootstrapOptions['firebaseConfig'] {
	return {
		apiKey: 'test-api-key',
		authDomain: 'test-project.firebaseapp.com',
		databaseURL: 'http://127.0.0.1:9000?ns=test-project',
		projectId: 'test-project',
		storageBucket: 'test-project.appspot.com',
		messagingSenderId: '000000000000',
		appId: '1:000000000000:web:test',
		measurementId: 'G-TEST',
	};
}

function createDependencies(): AdminBootstrapDependencies {
	return {
		bootstrapApplication: vi.fn().mockResolvedValue(undefined),
		connectAuthEmulator: vi.fn(),
		connectFunctionsEmulator: vi.fn(),
		enableProdMode: vi.fn(),
		getAnalytics: vi.fn().mockReturnValue('analytics'),
		getAuth: vi.fn().mockReturnValue('auth'),
		getFunctions: vi.fn().mockReturnValue('functions'),
		initializeApp: vi.fn().mockReturnValue('app'),
		initializeAppCheck: vi.fn(),
		provideHttpClient: vi.fn().mockReturnValue('http-provider'),
		provideIonicAngular: vi.fn().mockReturnValue('ionic-provider'),
		provideRouter: vi.fn().mockReturnValue('router-provider'),
		reCaptchaEnterpriseProvider: class ReCaptchaEnterpriseProvider {
			public readonly key: string;

			constructor(key: string) {
				this.key = key;
			}
		},
		withInterceptorsFromDi: vi.fn().mockReturnValue('interceptors'),
		withXhr: vi.fn().mockReturnValue('xhr'),
	} as unknown as AdminBootstrapDependencies;
}
