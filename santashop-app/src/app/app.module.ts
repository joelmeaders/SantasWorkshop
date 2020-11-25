import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { AngularFireModule } from '@angular/fire';
import {
  AngularFireAnalytics,
  AngularFireAnalyticsModule,
  CONFIG,
  ScreenTrackingService,
  UserTrackingService,
} from '@angular/fire/analytics';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { AngularFireStorageModule, BUCKET } from '@angular/fire/storage';
import { BrowserModule } from '@angular/platform-browser';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { IonicModule } from '@ionic/angular';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { AuthService } from 'santashop-core/src/public-api';
import { environment, firebaseConfig } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

export function httpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [AppComponent],
  entryComponents: [],
  imports: [
    HttpClientModule,
    BrowserModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: httpLoaderFactory,
        deps: [HttpClient],
      },
    }),
    AngularFireModule.initializeApp(firebaseConfig),
    AngularFirestoreModule,
    AngularFireAuthModule,
    AngularFireStorageModule,
    AngularFireAnalyticsModule,
    IonicModule.forRoot({
      mode: 'md',
    }),
    AppRoutingModule,
  ],
  exports: [TranslateModule],
  providers: [
    StatusBar,
    SplashScreen,
    // { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: BUCKET, useValue: 'gs://santas-workshop-193b5.appspot.com' },
    {
      provide: CONFIG,
      useValue: {
        debug_mode: !environment.production,
        app_name: environment.name,
        app_version: environment.version,
      },
    },
    AngularFireAnalytics,
    ScreenTrackingService,
    UserTrackingService,
    AuthService
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
