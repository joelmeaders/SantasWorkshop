import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { environment, firebaseConfig } from './environments/environment';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
	IonicRouteStrategy,
	provideIonicAngular,
} from '@ionic/angular/standalone';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import {
	provideAuth,
	getAuth,
	connectAuthEmulator,
	Auth,
} from '@angular/fire/auth';
import {
	provideFunctions,
	getFunctions,
	connectFunctionsEmulator,
} from '@angular/fire/functions';
import {
	provideFirestore,
	getFirestore,
	connectFirestoreEmulator,
} from '@angular/fire/firestore';
import { AppComponent } from './app/app.component';
import {
	provideHttpClient,
	withInterceptorsFromDi,
} from '@angular/common/http';
import {
	provideAnalytics,
	ScreenTrackingService,
	UserTrackingService,
} from '@angular/fire/analytics';
import { getAnalytics } from 'firebase/analytics';
import { routes } from './app/app.routes';
import { AuthWrapper } from '../../santashop-core/src';
import {
	initializeAppCheck,
	provideAppCheck,
	ReCaptchaEnterpriseProvider,
} from '@angular/fire/app-check';

const firebaseProviders = [
	provideFirebaseApp(() => initializeApp(firebaseConfig)),
	provideAppCheck(() =>
		initializeAppCheck(getApp(), {
			provider: new ReCaptchaEnterpriseProvider(environment.appCheckKey),
			isTokenAutoRefreshEnabled: true,
		}),
	),
	provideAuth(() => {
		const auth = getAuth();
		if (!environment.production) {
			connectAuthEmulator(auth, 'http://localhost:9099', {
				disableWarnings: true,
			});
		}
		return auth;
	}),
	provideFunctions(() => {
		const functions = getFunctions();
		functions.customDomain = location.origin;
		if (!environment.production) {
			connectFunctionsEmulator(functions, 'localhost', 5001);
			functions.customDomain = null;
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
		{
			provide: AuthWrapper,
			deps: [Auth],
		},
		UserTrackingService,
	],
}).catch((err) => console.log(err));
