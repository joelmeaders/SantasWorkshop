import { NgModule } from '@angular/core';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import {
	initializeAppCheck,
	provideAppCheck,
	ReCaptchaEnterpriseProvider,
} from '@angular/fire/app-check';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import {
	provideFirestore,
	getFirestore,
	connectFirestoreEmulator,
	enableMultiTabIndexedDbPersistence,
} from '@angular/fire/firestore';
import {
	provideFunctions,
	getFunctions,
	connectFunctionsEmulator,
} from '@angular/fire/functions';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicRouteStrategy } from '@ionic/angular/standalone';
import { environment, firebaseConfig } from '../environments/environment';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

let resolvePersistenceEnabled: (enabled: boolean) => void;

export const persistenceEnabled = new Promise<boolean>((resolve) => {
	resolvePersistenceEnabled = resolve;
});

if (!environment.production) {
	(self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
