import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private readonly translate: TranslateService,
    // private readonly analyticsService: AngularFireAnalytics,
    // private readonly maintenance: MaintenanceService,
    // private readonly signUpStatusService: SignUpStatusService
  ) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      // do something?
    });

    this.translate.addLangs(['en', 'es']);
    this.translate.setDefaultLang('en');
    const browserLang = this.translate.getBrowserLang();
    this.translate.use(browserLang.match(/en|es/) ? browserLang : 'en');
    // this.analyticsService.logEvent('default_language', { value: browserLang });
  }
}
