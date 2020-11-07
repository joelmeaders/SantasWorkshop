import { templateJitUrl } from '@angular/compiler';
import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { AuthService } from '@app/core/services/auth.service';
import { PublicMenuComponent } from '@app/shared/components/public-menu/public-menu.component';
import { PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil, filter, shareReplay } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnDestroy {

  private readonly $destroy = new Subject<void>();

  public readonly $customer = this.authService.$currentUser.pipe(
    takeUntil(this.$destroy),
    filter(user => !!user),
    shareReplay(1)
  );

  constructor(
    private readonly popoverController: PopoverController,
    private readonly analyticsService: AngularFireAnalytics,
    private readonly translate: TranslateService,
    private readonly authService: AuthService
  ) {
    analyticsService.setCurrentScreen('home');
    analyticsService.logEvent('screen_view');
  }

  ngOnDestroy() {
    this.$destroy.next();
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
