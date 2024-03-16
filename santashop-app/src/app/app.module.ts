import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { environment, firebaseConfig } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import {
	AuthWrapper,
	connectFirestoreEmulator,
	getFirestore,
	MOBILE_EVENT,
	PROFILE_VERSION,
	PROGRAM_YEAR,
	provideFirestore,
} from '@santashop/core';
import { RouteReuseStrategy } from '@angular/router';

import { getApp, initializeApp, provideFirebaseApp } from '@angular/fire/app';
import {
	initializeAppCheck,
	provideAppCheck,
	ReCaptchaEnterpriseProvider,
} from '@angular/fire/app-check';
import {
	provideAuth,
	connectAuthEmulator,
	getAuth,
	Auth,
} from '@angular/fire/auth';
import {
	connectStorageEmulator,
	getStorage,
	provideStorage,
} from '@angular/fire/storage';
import {
	connectFunctionsEmulator,
	getFunctions,
	provideFunctions,
} from '@angular/fire/functions';
import { enableMultiTabIndexedDbPersistence } from '@angular/fire/firestore';
import {
	getAnalytics,
	provideAnalytics,
	ScreenTrackingService,
	UserTrackingService,
} from '@angular/fire/analytics';

export const httpLoaderFactory = (http: HttpClient): TranslateHttpLoader =>
	new TranslateHttpLoader(http, './assets/i18n/', '.json');

let resolvePersistenceEnabled: (enabled: boolean) => void;

export const persistenceEnabled = new Promise<boolean>((resolve) => {
	resolvePersistenceEnabled = resolve;
});

if (!environment.production) {
	(self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// TODO: THis is a huge fucking mess. Make these into functions and use here instead
@NgModule({
	declarations: [AppComponent],
	imports: [
		BrowserModule,
		HttpClientModule,
		AppRoutingModule,
		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useFactory: httpLoaderFactory,
				deps: [HttpClient],
			},
		}),
		IonicModule.forRoot({
			mode: 'md',
			animated: true,
		}),
		provideFirebaseApp(() => initializeApp(firebaseConfig)),
		provideAppCheck(() =>
			initializeAppCheck(getApp(), {
				provider: new ReCaptchaEnterpriseProvider(
					environment.appCheckKey,
				),
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
			enableMultiTabIndexedDbPersistence(firestore).then(
				() => resolvePersistenceEnabled(true),
				() => resolvePersistenceEnabled(false),
			);
			return firestore;
		}),
		provideAnalytics(() => {
			const analytics = getAnalytics();
			return analytics;
		}),
	],
	providers: [
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
	bootstrap: [AppComponent],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
