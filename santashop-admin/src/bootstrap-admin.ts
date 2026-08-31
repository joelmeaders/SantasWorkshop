import { enableProdMode } from '@angular/core';
import {
	provideHttpClient,
	withInterceptorsFromDi,
	withXhr,
} from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
	connectFirestoreEmulator,
	getFirestore,
} from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';
import {
	initializeAppCheck,
	ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import {
	IonicRouteStrategy,
	provideIonicAngular,
} from '@ionic/angular/standalone';
import {
	FIREBASE_ANALYTICS,
	FIREBASE_APP,
	FIREBASE_AUTH,
	FIREBASE_FIRESTORE,
	FIREBASE_FUNCTIONS,
	PUBLIC_PARAMETERS_SOURCE,
	PROGRAM_YEAR,
	RealtimePublicParametersSource,
	SHOP_DAYS,
} from '@santashop/core';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { config } from './config';
import { firebaseConfig } from './firebase.config';

const FUNCTIONS_REGION = 'us-central1';

export type AdminBootstrapConfig = Pick<
	typeof config,
	| 'appCheckEnabled'
	| 'appCheckKey'
	| 'emulatorPorts'
	| 'production'
	| 'programYear'
	| 'shopDays'
>;

export interface AdminBootstrapDependencies {
	readonly bootstrapApplication: typeof bootstrapApplication;
	readonly connectAuthEmulator: typeof connectAuthEmulator;
	readonly connectFirestoreEmulator: typeof connectFirestoreEmulator;
	readonly connectFunctionsEmulator: typeof connectFunctionsEmulator;
	readonly enableProdMode: typeof enableProdMode;
	readonly getAnalytics: typeof getAnalytics;
	readonly getAuth: typeof getAuth;
	readonly getFirestore: typeof getFirestore;
	readonly getFunctions: typeof getFunctions;
	readonly initializeApp: typeof initializeApp;
	readonly initializeAppCheck: typeof initializeAppCheck;
	readonly provideHttpClient: typeof provideHttpClient;
	readonly provideIonicAngular: typeof provideIonicAngular;
	readonly provideRouter: typeof provideRouter;
	readonly reCaptchaEnterpriseProvider: typeof ReCaptchaEnterpriseProvider;
	readonly withInterceptorsFromDi: typeof withInterceptorsFromDi;
	readonly withXhr: typeof withXhr;
}

export interface AdminBootstrapOptions {
	readonly appComponent: typeof AppComponent;
	readonly config: AdminBootstrapConfig;
	readonly dependencies: AdminBootstrapDependencies;
	readonly firebaseConfig: typeof firebaseConfig;
	readonly logger: (error: unknown) => void;
	readonly origin: string;
	readonly routes: typeof routes;
}

const defaultDependencies: AdminBootstrapDependencies = {
	bootstrapApplication,
	connectAuthEmulator,
	connectFirestoreEmulator,
	connectFunctionsEmulator,
	enableProdMode,
	getAnalytics,
	getAuth,
	getFirestore,
	getFunctions,
	initializeApp,
	initializeAppCheck,
	provideHttpClient,
	provideIonicAngular,
	provideRouter,
	reCaptchaEnterpriseProvider: ReCaptchaEnterpriseProvider,
	withInterceptorsFromDi,
	withXhr,
};

const defaultOptions: AdminBootstrapOptions = {
	appComponent: AppComponent,
	config,
	dependencies: defaultDependencies,
	firebaseConfig,
	logger: (error: unknown): void => console.log(error),
	origin: location.origin,
	routes,
};

export function bootstrapAdminApplication(
	overrides: Partial<AdminBootstrapOptions> = {},
): Promise<void> {
	const options = { ...defaultOptions, ...overrides };
	const { config: runtimeConfig, dependencies } = options;
	const firebaseApp = dependencies.initializeApp(options.firebaseConfig);

	if (runtimeConfig.appCheckEnabled) {
		if (!runtimeConfig.production) {
			(
				self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }
			).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
		}

		dependencies.initializeAppCheck(firebaseApp, {
			provider: new dependencies.reCaptchaEnterpriseProvider(
				runtimeConfig.appCheckKey,
			),
			isTokenAutoRefreshEnabled: true,
		});
	}

	const firebaseAuth = dependencies.getAuth(firebaseApp);
	if (!runtimeConfig.production) {
		dependencies.connectAuthEmulator(
			firebaseAuth,
			`http://127.0.0.1:${runtimeConfig.emulatorPorts.auth}`,
			{ disableWarnings: true },
		);
	}

	const firebaseFunctions = runtimeConfig.production
		? dependencies.getFunctions(firebaseApp, options.origin)
		: dependencies.getFunctions(firebaseApp, FUNCTIONS_REGION);
	if (!runtimeConfig.production) {
		dependencies.connectFunctionsEmulator(
			firebaseFunctions,
			'127.0.0.1',
			runtimeConfig.emulatorPorts.functions,
		);
	}

	const firebaseFirestore = dependencies.getFirestore(firebaseApp);
	if (!runtimeConfig.production) {
		dependencies.connectFirestoreEmulator(
			firebaseFirestore,
			'127.0.0.1',
			runtimeConfig.emulatorPorts.firestore,
		);
	}

	const firebaseProviders = [
		{ provide: FIREBASE_APP, useValue: firebaseApp },
		{ provide: FIREBASE_AUTH, useValue: firebaseAuth },
		{ provide: FIREBASE_FUNCTIONS, useValue: firebaseFunctions },
		{ provide: FIREBASE_FIRESTORE, useValue: firebaseFirestore },
		RealtimePublicParametersSource,
		{
			provide: PUBLIC_PARAMETERS_SOURCE,
			useExisting: RealtimePublicParametersSource,
		},
		...(runtimeConfig.production
			? [
					{
						provide: FIREBASE_ANALYTICS,
						useValue: dependencies.getAnalytics(firebaseApp),
					},
				]
			: []),
	];

	if (runtimeConfig.production) {
		dependencies.enableProdMode();
	}

	return dependencies
		.bootstrapApplication(options.appComponent, {
			providers: [
				dependencies.provideRouter(options.routes),
				dependencies.provideHttpClient(
					dependencies.withXhr(),
					dependencies.withInterceptorsFromDi(),
				),
				dependencies.provideIonicAngular({
					mode: 'md',
					animated: true,
				}),
				...firebaseProviders,
				{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
				{ provide: PROGRAM_YEAR, useValue: runtimeConfig.programYear },
				{ provide: SHOP_DAYS, useValue: runtimeConfig.shopDays },
			],
		})
		.then(() => undefined)
		.catch(options.logger);
}
