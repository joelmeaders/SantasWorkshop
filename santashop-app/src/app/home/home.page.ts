import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { first } from 'rxjs/operators';
import { AuthService } from 'santashop-core/src/public-api';
import { PublicMenuComponent } from '../shared/components/public-menu/public-menu.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {

  public readonly $user = this.authService.$currentUser;

  constructor(
    private readonly popoverController: PopoverController,
    private readonly translate: TranslateService,
    private readonly authService: AuthService,
    private readonly analyticsService: AngularFireAnalytics
  ) { }

  public async profileMenu($event: any) {
    const popover = await this.popoverController.create({
      component: PublicMenuComponent,
      event: $event,
    });
    return await popover.present();
  }

  public async setLanguage(value: 'en' | 'es') {
    await this.translate.use(value).pipe(first()).toPromise();
    this.analyticsService.logEvent('set_language', { value });
  }
}
