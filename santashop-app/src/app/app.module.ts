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
import { AngularFireStorageModule, USE_EMULATOR as USE_STORAGE_EMULATOR } from '@angular/fire/compat/storage';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { environment, firebaseConfig } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AngularFireRemoteConfigModule, DEFAULTS as REMOTE_CONFIG_DEFAULTS, SETTINGS as REMOTE_CONFIG_SETTINGS } from '@angular/fire/compat/remote-config';
import { AngularFireAuthModule, USE_EMULATOR as USE_AUTH_EMULATOR, SETTINGS as AUTH_SETTINGS } from '@angular/fire/compat/auth';
import { AngularFirestoreModule, USE_EMULATOR as USE_FIRESTORE_EMULATOR } from '@angular/fire/compat/firestore';
import { USE_EMULATOR as USE_FUNCTIONS_EMULATOR, ORIGIN as FUNCTIONS_ORIGIN } from '@angular/fire/compat/functions';
import { AuthService, MOBILE_EVENT, PROFILE_VERSION, PROGRAM_YEAR } from '@core/*';
import { RouteReuseStrategy } from '@angular/router';
import { RecaptchaSettings, RECAPTCHA_NONCE, RECAPTCHA_SETTINGS } from 'ng-recaptcha';

export function httpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

  // TODO: THis is a huge fucking mess. Make these into functions and use here instead
@NgModule({
  declarations: [AppComponent],
  entryComponents: [],
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
    AngularFireAuthModule,
    AngularFireStorageModule,
    AngularFireAnalyticsModule,
    AngularFireRemoteConfigModule,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // App settings
    { provide: PROGRAM_YEAR, useValue: 2021 },
    { provide: PROFILE_VERSION, useValue: 1 },
    { provide: MOBILE_EVENT, useValue: true },
    // Storage
    // { provide: BUCKET, useValue: 'gs://santas-workshop-193b5.appspot.com' },
    { provide: USE_STORAGE_EMULATOR, useValue: !environment.production ? ['localhost', 9199] : undefined },
    // Analytics
    {
      provide: ANALYTICS_DEBUG_MODE,
      useValue: !environment.production
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
    // Remote Config
    { provide: REMOTE_CONFIG_DEFAULTS, useValue: { 'registrationEnabled': 'true', 'maintenanceModeEnabled': 'false', 'shopClosedWeather': 'false' } },
    { provide: REMOTE_CONFIG_SETTINGS, useFactory: () => !environment.production ? { minimumFetchIntervalMillis: 10_000 } : {} },
    { provide: AUTH_SETTINGS, useValue: { appVerificationDisabledForTesting: !environment.production } },
    AuthService,
    { provide: USE_AUTH_EMULATOR, useValue: !environment.production ? ['http://localhost:9099'] : undefined },
    { provide: USE_FIRESTORE_EMULATOR, useValue: !environment.production ? ['localhost', 8080] : undefined },
    { provide: USE_FUNCTIONS_EMULATOR, useValue: !environment.production ? ['localhost', 5001] : undefined },
    { provide: FUNCTIONS_ORIGIN, useFactory: () => !environment.production ? undefined : location.origin },
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
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
