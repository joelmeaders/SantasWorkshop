import {
	enableProdMode,
	inject,
	provideZoneChangeDetection,
} from '@angular/core';

import { environment, firebaseConfig } from './environments/environment';
import {
	provideFirebaseApp,
	initializeApp,
	getApp,
	FirebaseApp,
} from '@angular/fire/app';
import {
	provideAppCheck,
	initializeAppCheck,
	ReCaptchaEnterpriseProvider,
} from '@angular/fire/app-check';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import {
	provideFunctions,
	getFunctions,
	connectFunctionsEmulator,
} from '@angular/fire/functions';
import {
	provideAnalytics,
	getAnalytics,
	ScreenTrackingService,
	UserTrackingService,
} from '@angular/fire/analytics';
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
import {
	connectFirestoreEmulator,
	getFirestore,
	provideFirestore,
} from '@angular/fire/firestore';

const firebaseProviders = [
	provideFirebaseApp(() => initializeApp(firebaseConfig)),
	provideAppCheck(() =>
		initializeAppCheck(getApp(), {
			provider: new ReCaptchaEnterpriseProvider(environment.appCheckKey),
			isTokenAutoRefreshEnabled: true,
		}),
	),
	provideAuth(() => {
		const auth = getAuth(inject(FirebaseApp));
		if (!environment.production) {
			connectAuthEmulator(auth, 'http://localhost:9099', {
				disableWarnings: true,
			});
		}
		return auth;
	}),
	provideFunctions(() => {
		const functions = getFunctions();
		if (!environment.production) {
			connectFunctionsEmulator(functions, 'localhost', 5001);
		} else {
			functions.customDomain = location.origin;
		}
		return functions;
	}),
	provideFirestore(() => {
		const firestore = getFirestore();
		if (!environment.production) {
			connectFirestoreEmulator(firestore, 'localhost', 8080);
		}
		return firestore;
	}),
	provideAnalytics(() => getAnalytics()),
];

if (!environment.production) {
	(self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

if (environment.production) {
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
		ScreenTrackingService,
		UserTrackingService,
	],
}).catch((err) => console.log(err));
