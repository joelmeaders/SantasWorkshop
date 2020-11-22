import { ChangeDetectionStrategy, Component, NgZone, OnDestroy } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { AuthService } from 'santashop-core/src/public-api';
import { PublicMenuComponent } from '../shared/components/public-menu/public-menu.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnDestroy {

  private readonly $destroy = new Subject<void>();

  public readonly $user = new BehaviorSubject<any>(undefined);

  private readonly setUserSubscription = this.authService.$currentUser.pipe(
    takeUntil(this.$destroy),
    tap(v => this.zone.run(() => this.$user.next(v))),
  ).subscribe();

  constructor(
    private readonly popoverController: PopoverController,
    private readonly analyticsService: AngularFireAnalytics,
    private readonly translate: TranslateService,
    private readonly authService: AuthService,
    private readonly zone: NgZone
  ) {
    analyticsService.setCurrentScreen('home');
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
    this.analyticsService.logEvent(`set_language_${value}`);
  }
}
