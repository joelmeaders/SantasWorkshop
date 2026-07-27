import { enableProdMode, provideZoneChangeDetection } from '@angular/core';

import { config } from './config';
import { firebaseConfig } from './firebase.config';
import { initializeApp } from 'firebase/app';
import {
	initializeAppCheck,
	ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
	provideHttpClient,
	withInterceptorsFromDi,
} from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import {
	IonicRouteStrategy,
	provideIonicAngular,
} from '@ionic/angular/standalone';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import {
	FIREBASE_ANALYTICS,
	FIREBASE_APP,
	FIREBASE_AUTH,
	FIREBASE_FIRESTORE,
	FIREBASE_FUNCTIONS,
	PROGRAM_YEAR,
} from '@santashop/core';

const firebaseApp = initializeApp(firebaseConfig);

if (config.appCheckEnabled) {
	if (!config.production) {
		(
			self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }
		).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
	}

	initializeAppCheck(firebaseApp, {
		provider: new ReCaptchaEnterpriseProvider(config.appCheckKey),
		isTokenAutoRefreshEnabled: true,
	});
}

const firebaseAuth = getAuth(firebaseApp);
if (!config.production) {
	connectAuthEmulator(firebaseAuth, 'http://localhost:9099', {
		disableWarnings: true,
	});
}

const firebaseFunctions = config.production
	? getFunctions(firebaseApp, location.origin)
	: getFunctions(firebaseApp);
if (!config.production) {
	connectFunctionsEmulator(firebaseFunctions, 'localhost', 5001);
}

const firebaseFirestore = getFirestore(firebaseApp);
if (!config.production) {
	connectFirestoreEmulator(firebaseFirestore, 'localhost', 8080);
}

const firebaseProviders = [
	{ provide: FIREBASE_APP, useValue: firebaseApp },
	{ provide: FIREBASE_AUTH, useValue: firebaseAuth },
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
		...firebaseProviders,
		{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
		// App settings
		{ provide: PROGRAM_YEAR, useValue: 2025 },
	],
}).catch((err) => console.log(err));
