import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import {
	bootstrapCustomerApplication,
	FirebaseBootstrapDependencies,
	startCustomerApplication,
} from './bootstrap';
import { config } from './config';
import { firebaseConfig } from './firebase.config';

const firebaseDependencies: FirebaseBootstrapDependencies = {
	initializeApp,
	initializeAppCheck,
	ReCaptchaEnterpriseProvider,
	getAuth,
	connectAuthEmulator,
	getStorage,
	connectStorageEmulator,
	getFunctions,
	connectFunctionsEmulator,
	getFirestore,
	connectFirestoreEmulator,
	getAnalytics,
};

startCustomerApplication(() =>
	bootstrapCustomerApplication(
		config,
		firebaseConfig,
		firebaseDependencies,
		{ rootComponent: AppComponent, routes },
		bootstrapApplication,
		enableProdMode,
	),
);
