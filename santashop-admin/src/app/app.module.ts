import { NgModule } from '@angular/core';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import {
	provideFirestore,
	getFirestore,
	connectFirestoreEmulator,
} from '@angular/fire/firestore';
import {
	provideFunctions,
	getFunctions,
	connectFunctionsEmulator,
} from '@angular/fire/functions';
import { BrowserModule } from '@angular/platform-browser';

import { IonicModule } from '@ionic/angular';
import { environment, firebaseConfig } from '../environments/environment';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

@NgModule({
	declarations: [AppComponent],
	imports: [
		BrowserModule,
		IonicModule.forRoot({
			mode: 'md',
		}),
		AppRoutingModule,
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
	],
	bootstrap: [AppComponent],
})
export class AppModule {}
