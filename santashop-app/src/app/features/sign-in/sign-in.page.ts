import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ModalController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { filter, map, publishReplay, refCount, take, takeUntil } from 'rxjs/operators';
import { AuthService, IError } from 'santashop-core/src/public-api';
import { ResetPasswordComponent } from '../../shared/components/reset-password/reset-password.component';
import { SignInForm } from '../../shared/forms/sign-in';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.page.html',
  styleUrls: ['./sign-in.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage implements OnDestroy {
  public readonly form: FormGroup = SignInForm.form();
  public readonly formValidationMessages = SignInForm.validationMessages();

  public readonly $error = new Subject<IError>();
  private readonly $destroy = new Subject<void>();

  private readonly _$loading = new Subject<boolean>();
  public readonly $loading = this._$loading.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  public readonly $reload = this.route.queryParamMap.pipe(
    take(1),
    map(params => {
      const email = params.get('email');
      const reloaded = params.get('reloaded');
      return { email, reloaded };
    }),
    filter(res => !!res && !!res.email && res.reloaded !== '1'),
  ).subscribe(response => {
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
    this.router.onSameUrlNavigation = 'reload';
    this.router.navigate([], {
      queryParams: { reloaded: '1' },
      queryParamsHandling: 'merge',
    }).then(() => location.reload());
  });

  // This only triggers on an idb transaction error
  public readonly $email = this.route.queryParamMap.pipe(
    take(1),
    map(params => params.get('email')),
    filter(res => !!res),
  ).subscribe(email => {
    this.form.get('emailAddress').setValue(email);
  });

  constructor(
    private readonly authService: AuthService,
    private readonly loadingController: LoadingController,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly modalController: ModalController,
    private readonly alertController: AlertController,
    private readonly analyticsService: AngularFireAnalytics
  ) {
    analyticsService.setCurrentScreen('sign-in');
  }

  public async ngOnDestroy() {
    this.$destroy.next();
    try {
      await this.loadingController.dismiss();
    } catch {
      // Do nothing
    }
  }

  public async login() {

    const loginInfo = { ...this.form.value };

    if (loginInfo.emailAddress == null || loginInfo.password == null) {
      return;
    }

    this._$loading.next(true);

    const result = await this.authService
      .login(loginInfo.emailAddress, loginInfo.password)
      .then(async (response) => {
        this._$loading.next(false);
        return true;
      }).catch(async (error: IError) => {
        this._$loading.next(false);

        if (error.code == '11') {
          this.handleIDBFatalError();
        } else {
          await this.handleError(error);
        }

        return false;
      });

    if (!result) {
      return;
    }

    this.analyticsService.logEvent('sign_in');

    const profile = await this.authService.$userProfile.pipe(take(1)).toPromise();

    if (!!profile?.emailAddress && !!profile?.firstName && !!profile?.lastName && !!profile?.zipCode) {
      this.router.navigate(['/profile']);
    } else {
      this.router.navigate(['/sign-up-info']);
    }

  }

  private readonly showLoadingSubscription = this.$loading
    .pipe(
      takeUntil(this.$destroy),
    )
    .subscribe((loading) => (loading ? this.presentLoading() : this.destroyLoading()));

  private async presentLoading() {
    const loading = await this.loadingController.create({
      duration: 3000,
      message: 'Signing in...',
      translucent: true,
      backdropDismiss: true,
    });
    
    await loading.present();
  }

  private async handleIDBFatalError() {
    const alert = await this.alertController.create({
      header: `Device Issue`,
      message: `Please try again using a different browser or device. We apologize for the inconvenience`,
      buttons: ['Ok'],
    });

    await alert.present();
  }

  private async destroyLoading() {
    await this.loadingController.dismiss();
  }

  public async forgotPassword() {
    const modal = await this.modalController.create({
      component: ResetPasswordComponent,
    });

    await modal.present();
  }

  private async handleError(error: IError) {

    const alert = await this.alertController.create({
      header: 'Error',
      subHeader: error.code,
      message: error.message,
      buttons: ['Ok']
    });

    await alert.present();

  }
}
