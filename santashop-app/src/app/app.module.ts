import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA, isDevMode, NgModule } from '@angular/core';
import { AngularFireModule } from '@angular/fire/compat';
import {
  AngularFireAnalytics,
  AngularFireAnalyticsModule,
  CONFIG as ANALYTICS_CONFIG,
  ScreenTrackingService,
  UserTrackingService,
} from '@angular/fire/compat/analytics';
import { AngularFireStorageModule, BUCKET } from '@angular/fire/compat/storage';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { environment, firebaseConfig } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AngularFireRemoteConfigModule, DEFAULTS as REMOTE_CONFIG_DEFAULTS, SETTINGS as USE_REMOTE_EMULATOR } from '@angular/fire/compat/remote-config';
import { AngularFireAuthModule, USE_EMULATOR as USE_AUTH_EMULATOR, SETTINGS as AUTH_SETTINGS } from '@angular/fire/compat/auth';
import { AngularFirestoreModule, USE_EMULATOR as USE_FIRESTORE_EMULATOR } from '@angular/fire/compat/firestore';
import { USE_EMULATOR as USE_FUNCTIONS_EMULATOR, ORIGIN as FUNCTIONS_ORIGIN } from '@angular/fire/compat/functions';
import { USE_EMULATOR as USE_DATABASE_EMULATOR } from '@angular/fire/compat/database';
import { AuthService, DEMO_MODE, MOBILE_EVENT, PROGRAM_YEAR } from '@core/*';
import { customAnimation } from './core';
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
      navAnimation: customAnimation
    }),
    AngularFireModule.initializeApp(firebaseConfig),
    AngularFirestoreModule,
    AngularFireAuthModule,
    AngularFireStorageModule,
    AngularFireAnalyticsModule,
    AngularFireRemoteConfigModule,
  ],
  // exports: [TranslateModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // App settings
    { provide: PROGRAM_YEAR, useValue: 2021 },
    { provide: MOBILE_EVENT, useValue: false },
    { provide: DEMO_MODE, useValue: true },
    // Storage
    { provide: BUCKET, useValue: 'gs://santas-workshop-193b5.appspot.com' },
    // Analytics
    {
      provide: ANALYTICS_CONFIG,
      useValue: {
        debug_mode: isDevMode(),
        app_name: environment.name ?? "",
        app_version: environment.version ?? "",
      },
    },
    // Remote Config
    { provide: REMOTE_CONFIG_DEFAULTS, useValue: { valueName: "valueValue" } },
    { provide: USE_REMOTE_EMULATOR, useFactory: () => isDevMode() ? { minimumFetchIntervalMillis: 10_000 } : {} },
    { provide: AUTH_SETTINGS, useValue: { appVerificationDisabledForTesting: !isDevMode() } },
    AngularFireAnalytics,
    ScreenTrackingService,
    UserTrackingService,
    AuthService,
    // MaintenanceService,
    { provide: USE_AUTH_EMULATOR, useValue: isDevMode() ? ['http://localhost:9099'] : undefined },
    { provide: USE_FIRESTORE_EMULATOR, useValue: isDevMode() ? ['localhost', 8080] : undefined },
    { provide: USE_DATABASE_EMULATOR, useValue: isDevMode() ? ['localhost', 9000] : undefined },
    { provide: USE_FUNCTIONS_EMULATOR, useValue: isDevMode() ? ['localhost', 5001] : undefined },
    { provide: FUNCTIONS_ORIGIN, useFactory: () => isDevMode() ? undefined : location.origin },
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
