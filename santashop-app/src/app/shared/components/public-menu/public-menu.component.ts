import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { Router } from '@angular/router';
import { PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { publishReplay, refCount, takeUntil } from 'rxjs/operators';
import { SignUpStatusService } from 'santashop-app/src/app/core/services/sign-up-status.service';
import { AuthService } from 'santashop-core/src';

@Component({
  selector: 'app-public-menu',
  templateUrl: './public-menu.component.html',
  styleUrls: ['./public-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicMenuComponent implements OnDestroy {

  private readonly $destroy = new Subject<void>();

  public readonly $isLoggedIn = this.authService.currentUser$.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  public readonly $signupEnabled = this.signUpStatusService.$signupEnabled.pipe(
    takeUntil(this.$destroy),
    publishReplay(),
    refCount()
  );

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly popoverController: PopoverController,
    private readonly translateService: TranslateService,
    private readonly analyticsService: AngularFireAnalytics,
    private readonly signUpStatusService: SignUpStatusService
  ) { }

  public ngOnDestroy(): void {
    this.$destroy.next();
  }

  public async closeMenu() {
    await this.popoverController.dismiss();
  }

  public async home() {
    await this.router.navigate(['/']);
    await this.closeMenu();
  }

  public async profile() {
    await this.router.navigate(['/profile']);
    await this.closeMenu();
  }

  public async signIn() {
    await this.router.navigate(['/sign-in']);
    await this.closeMenu();
  }

  public async createAccount() {
    await this.router.navigate(['/sign-up-account']);
    await this.closeMenu();
  }

  public async logout() {
    await this.authService.logout();
    await this.closeMenu();
    location.reload();
  }

  public async setLanguage(value: 'en' | 'es') {
    this.translateService.use(value);
    await this.analyticsService.logEvent(`set_language_${value}`);
    await this.closeMenu();
  }

}
