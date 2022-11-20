import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule } from '@ionic/angular';
import { environment, firebaseConfig } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import {
	AuthWrapper,
	MOBILE_EVENT,
	PROFILE_VERSION,
	PROGRAM_YEAR,
} from '@core/*';
import { AppComponent } from './app.component';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import {
	provideAuth,
	connectAuthEmulator,
	getAuth,
	Auth,
} from '@angular/fire/auth';
import {
	connectFirestoreEmulator,
	getFirestore,
	provideFirestore,
} from '@angular/fire/firestore';
import { getAnalytics, provideAnalytics } from '@angular/fire/analytics';
import {
	provideFunctions,
	getFunctions,
	connectFunctionsEmulator,
} from '@angular/fire/functions';

@NgModule({
	declarations: [AppComponent],
	imports: [
		BrowserModule,
		AppRoutingModule,
		IonicModule.forRoot({
			mode: 'md',
		}),
		provideFirebaseApp(() => initializeApp(firebaseConfig)),
		provideAuth(() => {
			const auth = getAuth();
			if (!environment.production) {
				connectAuthEmulator(auth, 'http://localhost:9099', {
					disableWarnings: true,
				});
			}
			return auth;
		}),
		provideFirestore(() => {
			const firestore = getFirestore();
			if (!environment.production) {
				connectFirestoreEmulator(firestore, 'localhost', 8080);
			}
			return firestore;
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
		provideAnalytics(() => {
			const analytics = getAnalytics();
			return analytics;
		}),
	],
	providers: [
		// { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
		{ provide: PROGRAM_YEAR, useValue: 2022 },
		{ provide: PROFILE_VERSION, useValue: 1 },
		{ provide: MOBILE_EVENT, useValue: false },
		{
			provide: AuthWrapper,
			deps: [Auth],
		},
	],
	bootstrap: [AppComponent],
})
export class AppModule {}
