import {
	enableProdMode,
	provideZoneChangeDetection,
	importProvidersFrom,
} from '@angular/core';

import { environment, firebaseConfig } from './environments/environment';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import {
	provideAppCheck,
	initializeAppCheck,
	ReCaptchaEnterpriseProvider,
} from '@angular/fire/app-check';
import {
	provideAuth,
	getAuth,
	connectAuthEmulator,
	Auth,
} from '@angular/fire/auth';
import {
	provideStorage,
	getStorage,
	connectStorageEmulator,
} from '@angular/fire/storage';
import {
	provideFunctions,
	getFunctions,
	connectFunctionsEmulator,
} from '@angular/fire/functions';
import {
	provideFirestore,
	getFirestore,
	connectFirestoreEmulator,
	PROGRAM_YEAR,
	PROFILE_VERSION,
	MOBILE_EVENT,
	AuthWrapper,
} from '@santashop/core';
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
	HttpClient,
} from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { routes } from './app/app.routes';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { AppComponent } from './app/app.component';
import {
	IonicRouteStrategy,
	provideIonicAngular,
} from '@ionic/angular/standalone';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

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
	provideStorage(() => {
		const storage = getStorage();
		if (!environment.production) {
			connectStorageEmulator(storage, 'localhost', 9199);
		}
		return storage;
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

export const httpLoaderFactory = (http: HttpClient): TranslateHttpLoader =>
	new TranslateHttpLoader(http, './assets/i18n/', '.json');

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
		importProvidersFrom(
			TranslateModule.forRoot({
				loader: {
					provide: TranslateLoader,
					useFactory: httpLoaderFactory,
					deps: [HttpClient],
				},
			}),
		),
		...firebaseProviders,
		{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
		// App settings
		{ provide: PROGRAM_YEAR, useValue: 2023 },
		{ provide: PROFILE_VERSION, useValue: 1 },
		{ provide: MOBILE_EVENT, useValue: true },
		ScreenTrackingService,
		{
			provide: AuthWrapper,
			deps: [Auth],
		},
		UserTrackingService,
	],
}).catch((err) => console.log(err));
