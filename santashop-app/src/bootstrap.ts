import { ApplicationConfig, ApplicationRef, enableProdMode, Type } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideRouter, RouteReuseStrategy, Routes } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import {
	FIREBASE_ANALYTICS,
	FIREBASE_APP,
	FIREBASE_AUTH,
	FIREBASE_FUNCTIONS,
	FIREBASE_STORAGE,
	MOBILE_EVENT,
	PROFILE_VERSION,
	PROGRAM_YEAR,
	PUBLIC_PARAMETERS_SOURCE,
	SHOP_DAYS,
} from '@santashop/core/customer';
import {
	CUSTOMER_APP_CONFIG,
	FIREBASE_FIRESTORE_LITE,
} from './app/core/tokens/customer-runtime.token';
import type { CustomerAppConfig } from './app/core/tokens/customer-runtime.token';
import { LitePublicParametersSource } from './app/core/services/lite-public-parameters-source.service';

export type { CustomerAppConfig } from './app/core/tokens/customer-runtime.token';

export interface FirebaseBootstrapDependencies {
	initializeApp: (firebaseConfig: any) => any;
	initializeAppCheck: (app: any, options: any) => any;
	ReCaptchaEnterpriseProvider: new (siteKey: string) => any;
	getAuth: (app: any) => any;
	connectAuthEmulator: (auth: any, url: string, options: any) => void;
	getStorage: (app: any) => any;
	connectStorageEmulator: (storage: any, host: string, port: number) => void;
	getFunctions: (app: any, regionOrCustomDomain?: string) => any;
	connectFunctionsEmulator: (functions: any, host: string, port: number) => void;
	getFirestoreLite: (app: any) => any;
	connectFirestoreLiteEmulator: (
		firestore: any,
		host: string,
		port: number,
	) => void;
	getAnalytics: (app: any) => any;
}

export type BootstrapApplication = (
	rootComponent: Type<unknown>,
	options: ApplicationConfig,
) => Promise<ApplicationRef>;

export interface CustomerApplication {
	rootComponent: Type<unknown>;
	routes: Routes;
}

const FUNCTIONS_REGION = 'us-central1';

export const bootstrapCustomerApplication = (
	appConfig: CustomerAppConfig,
	firebaseConfig: unknown,
	firebase: FirebaseBootstrapDependencies,
	application: CustomerApplication,
	bootstrap: BootstrapApplication,
	activateProdMode: () => void = enableProdMode,
): Promise<ApplicationRef> => {
	const firebaseApp = firebase.initializeApp(firebaseConfig);

	if (appConfig.appCheckEnabled) {
		if (!appConfig.production) {
			(self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
				.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
		}

		firebase.initializeAppCheck(firebaseApp, {
			provider: new firebase.ReCaptchaEnterpriseProvider(
				appConfig.appCheckKey,
			),
			isTokenAutoRefreshEnabled: true,
		});
	}

	const firebaseAuth = firebase.getAuth(firebaseApp);
	const firebaseStorage = firebase.getStorage(firebaseApp);
	const firebaseFunctions = appConfig.production
		? firebase.getFunctions(firebaseApp, location.origin)
		: firebase.getFunctions(firebaseApp, FUNCTIONS_REGION);
	const firebaseFirestoreLite = firebase.getFirestoreLite(firebaseApp);

	if (!appConfig.production) {
		firebase.connectAuthEmulator(
			firebaseAuth,
			`http://127.0.0.1:${appConfig.emulatorPorts.auth}`,
			{ disableWarnings: true },
		);
		firebase.connectStorageEmulator(
			firebaseStorage,
			'127.0.0.1',
			appConfig.emulatorPorts.storage,
		);
		firebase.connectFunctionsEmulator(
			firebaseFunctions,
			'127.0.0.1',
			appConfig.emulatorPorts.functions,
		);
		firebase.connectFirestoreLiteEmulator(
			firebaseFirestoreLite,
			'127.0.0.1',
			appConfig.emulatorPorts.firestore,
		);
	}

	if (appConfig.production) {
		activateProdMode();
	}

	return bootstrap(application.rootComponent, {
		providers: [
			provideRouter(application.routes),
			provideHttpClient(withXhr(), withInterceptorsFromDi()),
			provideIonicAngular({ mode: 'md', animated: true }),
			provideTranslateService({
				fallbackLang: 'en',
				loader: provideTranslateHttpLoader({
					prefix: './assets/i18n/',
					suffix: '.json',
				}),
			}),
			{ provide: FIREBASE_APP, useValue: firebaseApp },
			{ provide: FIREBASE_AUTH, useValue: firebaseAuth },
			{ provide: FIREBASE_STORAGE, useValue: firebaseStorage },
			{ provide: FIREBASE_FUNCTIONS, useValue: firebaseFunctions },
			{ provide: FIREBASE_FIRESTORE_LITE, useValue: firebaseFirestoreLite },
			{ provide: CUSTOMER_APP_CONFIG, useValue: appConfig },
			LitePublicParametersSource,
			{
				provide: PUBLIC_PARAMETERS_SOURCE,
				useExisting: LitePublicParametersSource,
			},
			...(appConfig.production
				? [
						{
							provide: FIREBASE_ANALYTICS,
							useValue: firebase.getAnalytics(firebaseApp),
						},
					]
				: []),
			{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
			{ provide: PROGRAM_YEAR, useValue: appConfig.programYear },
			{ provide: SHOP_DAYS, useValue: appConfig.shopDays },
			{ provide: PROFILE_VERSION, useValue: 1 },
			{ provide: MOBILE_EVENT, useValue: true },
		],
	});
};

export const startCustomerApplication = (
	bootstrap: () => Promise<ApplicationRef>,
	logError: (error: unknown) => void = console.log,
): void => {
	void bootstrap().catch(logError);
};
