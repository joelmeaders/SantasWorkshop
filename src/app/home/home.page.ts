import { templateJitUrl } from '@angular/compiler';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { PublicMenuComponent } from '@app/shared/components/public-menu/public-menu.component';
import { PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  constructor(
    private readonly popoverController: PopoverController,
    private readonly analyticsService: AngularFireAnalytics,
    private readonly translate: TranslateService
  ) {
    analyticsService.setCurrentScreen('home');
    analyticsService.logEvent('screen_view');

    translate.addLangs(['en', 'es']);
    translate.setDefaultLang('en');

    const browserLang = translate.getBrowserLang();
    translate.use(browserLang.match(/en|es/) ? browserLang : 'en');
  }

  public async profileMenu($event: any) {
    const popover = await this.popoverController.create({
      component: PublicMenuComponent,
      event: $event,
    });
    return await popover.present();
  }

  public setLanguage(value: 'en' | 'es') {
    this.translate.use(value);
  }
}
