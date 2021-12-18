import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { AngularFireModule } from '@angular/fire/compat';
import {
  AngularFireAnalytics,
  AngularFireAnalyticsModule,
  ScreenTrackingService,
  UserTrackingService,
  DEBUG_MODE as ANALYTICS_DEBUG_MODE,
  APP_NAME, APP_VERSION
} from '@angular/fire/compat/analytics';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { environment, firebaseConfig } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AngularFirestoreModule, USE_EMULATOR as USE_FIRESTORE_EMULATOR } from '@angular/fire/compat/firestore';
import { AuthService, MOBILE_EVENT, PROFILE_VERSION, PROGRAM_YEAR } from '@core/*';
import { RouteReuseStrategy } from '@angular/router';
import { RecaptchaSettings, RECAPTCHA_NONCE, RECAPTCHA_SETTINGS } from 'ng-recaptcha';

import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, connectAuthEmulator, getAuth } from '@angular/fire/auth';
import { connectStorageEmulator, getStorage, provideStorage } from '@angular/fire/storage';
import { getRemoteConfig, provideRemoteConfig } from '@angular/fire/remote-config';
import { connectFunctionsEmulator, getFunctions, provideFunctions } from '@angular/fire/functions';

export function httpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
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
            animated: true
        }),
        AngularFireModule.initializeApp(firebaseConfig),
        AngularFirestoreModule,
        provideFirebaseApp(() => initializeApp(firebaseConfig)),
        provideAuth(() => {
          const auth = getAuth();
          if (!environment.production) {
            connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
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
        provideRemoteConfig(() => {
          const remoteConfig = getRemoteConfig();
          remoteConfig.defaultConfig = { 'registrationEnabled': 'true', 'maintenanceModeEnabled': 'false', 'shopClosedWeather': 'false' };
          remoteConfig.settings.minimumFetchIntervalMillis = 10000;
          return remoteConfig;
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
        AngularFireAnalyticsModule,
    ],
    providers: [
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        // App settings
        { provide: PROGRAM_YEAR, useValue: 2021 },
        { provide: PROFILE_VERSION, useValue: 1 },
        { provide: MOBILE_EVENT, useValue: true },
        // Analytics
        {
            provide: ANALYTICS_DEBUG_MODE,
            useValue: false // !environment.production
        },
        {
            provide: APP_NAME,
            useValue: environment.name ?? ""
        },
        {
            provide: APP_VERSION,
            useValue: environment.version ?? ""
        },
        AngularFireAnalytics,
        ScreenTrackingService,
        UserTrackingService,
        AuthService,
        { provide: USE_FIRESTORE_EMULATOR, useValue: !environment.production ? ['localhost', 8080] : undefined },
        {
            provide: RECAPTCHA_SETTINGS,
            useValue: { siteKey: '6LeY5ecZAAAAALhmvzhfTcdbzHsYbmHmmk11HbHN', badge: 'inline' } as RecaptchaSettings
        },
        {
            provide: RECAPTCHA_NONCE,
            useValue: '8wiehfsdncil8wKUyla8inkiygseteifnkcnkjsdnosidhf8iehf'
        }
    ],
    bootstrap: [AppComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {}
