import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/compat/analytics';
import { Platform } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { AppStateService } from './core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private readonly translate: TranslateService,
    private readonly appStateService: AppStateService,
    private readonly analyticsService: AngularFireAnalytics,
  ) {
    this.initializeApp();
  }

  async initializeApp() {
    this.platform.ready().then(() => {
      console.log('AppStateService Injected', !!this.appStateService)
    });

    this.translate.addLangs(['en', 'es']);
    this.translate.setDefaultLang('en');
    const browserLang = this.translate.getBrowserLang();
    this.translate.use(browserLang.match(/en|es/) ? browserLang : 'en');
    await this.analyticsService.logEvent('default_language', { value: browserLang });
  }
}
