import { enableProdMode, provideZoneChangeDetection } from '@angular/core';

import { config } from './config';
import { firebaseConfig } from './firebase.config';
import {
	initializeAppCheck,
	ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import {
	FIREBASE_ANALYTICS,
	FIREBASE_APP,
	FIREBASE_AUTH,
	FIREBASE_FIRESTORE,
	FIREBASE_FUNCTIONS,
	FIREBASE_STORAGE,
	MOBILE_EVENT,
	PROFILE_VERSION,
	PROGRAM_YEAR,
} from '@santashop/core';
import { getAnalytics } from 'firebase/analytics';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
	provideHttpClient,
	withInterceptorsFromDi,
} from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { routes } from './app/app.routes';
import { provideTranslateService } from '@ngx-translate/core';
import { AppComponent } from './app/app.component';
import {
	IonicRouteStrategy,
	provideIonicAngular,
} from '@ionic/angular/standalone';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const firebaseApp = initializeApp(firebaseConfig);
const FUNCTIONS_REGION = 'us-central1';

if (config.appCheckEnabled) {
	if (!config.production) {
		(self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
	}

	initializeAppCheck(firebaseApp, {
		provider: new ReCaptchaEnterpriseProvider(config.appCheckKey),
		isTokenAutoRefreshEnabled: true,
	});
}

const firebaseAuth = getAuth(firebaseApp);
if (!config.production) {
	connectAuthEmulator(
		firebaseAuth,
		`http://127.0.0.1:${config.emulatorPorts.auth}`,
		{
			disableWarnings: true,
		},
	);
}

const firebaseStorage = getStorage(firebaseApp);
if (!config.production) {
	connectStorageEmulator(
		firebaseStorage,
		'127.0.0.1',
		config.emulatorPorts.storage,
	);
}

const firebaseFunctions = config.production
	? getFunctions(firebaseApp, location.origin)
	: getFunctions(firebaseApp, FUNCTIONS_REGION);
if (!config.production) {
	connectFunctionsEmulator(
		firebaseFunctions,
		'127.0.0.1',
		config.emulatorPorts.functions,
	);
}

const firebaseFirestore = getFirestore(firebaseApp);
if (!config.production) {
	connectFirestoreEmulator(
		firebaseFirestore,
		'127.0.0.1',
		config.emulatorPorts.firestore,
	);
}

const firebaseProviders = [
	{ provide: FIREBASE_APP, useValue: firebaseApp },
	{ provide: FIREBASE_AUTH, useValue: firebaseAuth },
	{ provide: FIREBASE_STORAGE, useValue: firebaseStorage },
	{ provide: FIREBASE_FUNCTIONS, useValue: firebaseFunctions },
	{ provide: FIREBASE_FIRESTORE, useValue: firebaseFirestore },
	...(config.production
		? [{ provide: FIREBASE_ANALYTICS, useValue: getAnalytics(firebaseApp) }]
		: []),
];

if (config.production) {
	enableProdMode();
}

bootstrapApplication(AppComponent, {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(routes),
		provideHttpClient(withInterceptorsFromDi()),
		provideIonicAngular({
			mode: 'md',
			animated: true,
		}),
		provideTranslateService({
			fallbackLang: 'en',
			loader: provideTranslateHttpLoader({
				prefix: './assets/i18n/',
				suffix: '.json',
			}),
		}),
		...firebaseProviders,
		{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
		// App settings
		{ provide: PROGRAM_YEAR, useValue: 2025 },
		{ provide: PROFILE_VERSION, useValue: 1 },
		{ provide: MOBILE_EVENT, useValue: true },
	],
}).catch((err) => console.log(err));
