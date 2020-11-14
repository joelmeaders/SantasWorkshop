import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { IError } from '@app/core/models/base/i-errors';
import { AuthService } from '@app/core/services/auth.service';
import { IRegistration, UserRegistrationService } from '@app/core/services/user-registration.service';
import { SignUpAccountForm } from '@app/shared/forms/sign-up-account';
import { LegalHelpers } from '@app/shared/legal';
import { LoadingController, AlertController, ModalController } from '@ionic/angular';
import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, publishReplay, refCount, shareReplay } from 'rxjs/operators';

@Component({
  selector: 'app-sign-up-account',
  templateUrl: './sign-up-account.page.html',
  styleUrls: ['./sign-up-account.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignUpAccountPage implements OnDestroy {

  public readonly form: FormGroup = SignUpAccountForm.form();
  public readonly formValidationMessages = SignUpAccountForm.validationMessages();

  public readonly $error = new Subject<IError>();
  private readonly $destroy = new Subject<void>();

  private readonly _$loading = new Subject<boolean>();
  public readonly $loading = this._$loading.pipe(takeUntil(this.$destroy), publishReplay(1), refCount());

  private readonly _$showPassword = new BehaviorSubject<boolean>(false);
  public readonly $showPassword = this._$showPassword.pipe(takeUntil(this.$destroy), shareReplay(1));

  constructor(
    private readonly userRegistrationService: UserRegistrationService,
    private readonly loadingController: LoadingController,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly alertController: AlertController,
    private readonly modalController: ModalController,
    private readonly analyticsService: AngularFireAnalytics,
  ) { 
    analyticsService.setCurrentScreen('sign-up-account');
    analyticsService.logEvent('screen_view');
  }

  public async ngOnDestroy() {
    this.$destroy.next();
    try {
      await this.loadingController.dismiss();
    } catch {
      // Do nothing
    }
  }

  public togglePassword(): void {
    const current = this._$showPassword.getValue();
    this._$showPassword.next(!current);
  }

  public async createAccount() {
    this._$loading.next(true);

    const info: IRegistration = {
      ...this.form.value,
    };

    const result = await this.userRegistrationService
      .registerAccount(info)
      .then((resolve: firebase.default.auth.UserCredential) => {
        this._$loading.next(false);
        this.analyticsService.logEvent('sign_up_1');
        return true;
      })
      .catch(async (error: IError) => {

        this._$loading.next(false);

        if (error.code == '11') {
          await this.signInNeeded();

          this.router.navigate(['/sign-in'], {
            queryParams: { email: `${this.form.get('emailAddress').value}` },
          });

          return false;
        }

        if (error.code === 'auth/email-already-in-use') {
          const tryLogIn = await this.authService.login(info.emailAddress, info.password)
            .then(response => true)
            .catch(response => false);
          
          if (tryLogIn) {
            return true;
          }
        }

        await this.handleError(error);

        return false;
      });

    if (result) {
      this.redirectToStepTwo();
    }
  }

  private redirectToStepTwo() {
    this.router.navigate(['/sign-up-info']);
  }

  private readonly showLoadingSubscription = this.$loading
    .pipe(takeUntil(this.$destroy))
    .subscribe((loading) => (loading ? this.presentLoading() : this.destroyLoading()));

  private async presentLoading() {
    const loading = await this.loadingController.create({
      duration: 3000,
      message: 'Creating your account!',
      translucent: true,
      backdropDismiss: true,
    });
    await loading.present();
  }

  private async destroyLoading() {
    await this.loadingController.dismiss();
  }

  private async handleError(error: IError) {
    const alert = await this.alertController.create({
      header: 'Error',
      subHeader: error.code,
      message: error.message,
      buttons: ['Ok'],
    });

    await alert.present();
  }

  private async signInNeeded() {
    const alert = await this.alertController.create({
      header: 'Account Created',
      message: 'Now sign into the account you just created',
      buttons: ['Ok'],
    });

    await alert.present();
  }

  public async privacy() {
    await LegalHelpers.privacyPolicy(this.modalController);
  }

  public async terms() {
    await LegalHelpers.termsOfService(this.modalController);
  }

}
