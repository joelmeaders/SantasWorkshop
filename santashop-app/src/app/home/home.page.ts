import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
// import { AngularFireAnalytics } from '@angular/fire/analytics';
import { PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { first, map, publishReplay, refCount, takeUntil } from 'rxjs/operators';
import { AuthService } from 'santashop-core/src';
import { RemoteConfigService } from '../core/services/remote-config.service';
import { PublicMenuComponent } from '../shared/components/public-menu/public-menu.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnDestroy {

  private readonly $destroy = new Subject<void>();
  public readonly $user = this.authService.currentUser$;

  // TODO: Remote config
  public readonly $signupEnabled = this.remoteConfigService.registrationEnabled$.pipe(
    takeUntil(this.$destroy),
    map(value => !value),
    publishReplay(),
    refCount()
  );

  constructor(
    private readonly popoverController: PopoverController,
    private readonly translate: TranslateService,
    private readonly authService: AuthService,
    // private readonly analyticsService: AngularFireAnalytics,
    private readonly remoteConfigService: RemoteConfigService
  ) { }

  ngOnDestroy(): void {
    this.$destroy.next();
  }

  public async profileMenu($event: any) {
    const popover = await this.popoverController.create({
      component: PublicMenuComponent,
      event: $event,
    });
    return popover.present();
  }

  public async setLanguage(value: 'en' | 'es') {
    await this.translate.use(value).pipe(first()).toPromise();
    // this.analyticsService.logEvent('set_language', { value });
  }
}
