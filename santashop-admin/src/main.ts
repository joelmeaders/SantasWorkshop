import { enableProdMode, importProvidersFrom } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { persistenceEnabled } from './app/app.module';
import { environment, firebaseConfig } from './environments/environment';
import { RouteReuseStrategy } from '@angular/router';
import { IonicRouteStrategy } from '@ionic/angular/standalone';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { AppRoutingModule } from './app/app-routing.module';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
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
    provideFirestore,
    getFirestore,
    connectFirestoreEmulator,
    enableMultiTabIndexedDbPersistence,
} from '@angular/fire/firestore';
import { AppComponent } from './app/app.component';

let resolvePersistenceEnabled: (enabled: boolean) => void;

if (environment.production) {
    enableProdMode();
}

bootstrapApplication(AppComponent, {
    providers: [
        importProvidersFrom(
            BrowserModule,
            AppRoutingModule,
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
        ),
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        provideIonicAngular({
            mode: 'md',
        })
    ],
}).catch((err) => console.log(err));
