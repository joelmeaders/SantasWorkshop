import { ChangeDetectionStrategy, Component, OnDestroy, ViewChild } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { AngularFireFunctions } from '@angular/fire/functions';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { publishReplay, refCount, shareReplay, take, takeUntil } from 'rxjs/operators';
import { AuthService, IError } from 'santashop-core/src/public-api';
import { IRegistration, UserRegistrationService } from '../../services/user-registration.service';
import { SignUpAccountForm } from '../../shared/forms/sign-up-account';
import { LegalHelpers } from '../../shared/legal';

@Component({
  selector: 'app-sign-up-account',
  templateUrl: './sign-up-account.page.html',
  styleUrls: ['./sign-up-account.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignUpAccountPage implements OnDestroy {

  public readonly form: FormGroup = SignUpAccountForm.form();
  public readonly formValidationMessages = SignUpAccountForm.validationMessages();

  @ViewChild('captchaRef') captchaRef: ReCaptchaV2.ReCaptcha;

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
    private readonly angularFireFunctions: AngularFireFunctions,
    private readonly translateService: TranslateService
  ) { 
    analyticsService.setCurrentScreen('sign-up-account');
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

  public async createAccount($event: any) {

    const status = 
      await this.angularFireFunctions.httpsCallable('verifyRecaptcha')({value: $event}).pipe(take(1)).toPromise();

    if (!status) {
      await this.failedVerification();
      return;
    }

    const info: IRegistration = {
      ...this.form.value,
    };

    const shouldContinue = await this.verifyEmail(info.emailAddress);

    if (shouldContinue.role === 'cancel') {
      this.captchaRef.reset();
      return;
    }

    this._$loading.next(true);

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
      message: this.translateService.instant('SIGNUP_ACCOUNT.CREATING'),
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
      header: this.translateService.instant('COMMON.ERROR'),
      subHeader: error.code,
      message: error.message,
      buttons: [this.translateService.instant('COMMON.OK')],
    });

    await alert.present();
  }

  private async signInNeeded() {
    const alert = await this.alertController.create({
      header: this.translateService.instant('SIGNUP_ACCOUNT.CREATED'),
      message: this.translateService.instant('SIGNUP_ACCOUNT.NOW_SIGN_IN'),
      buttons: [this.translateService.instant('COMMON.OK')],
    });

    await alert.present();
  }

  private async verifyEmail(email: string) {
    const alert = await this.alertController.create({
      header: this.translateService.instant('SIGNUP_ACCOUNT.CONFIRM_EMAIL'),
      subHeader: email,
      message: this.translateService.instant('SIGNUP_ACCOUNT.CONFIRM_EMAIL_MSG'),
      buttons: [
        {
          text: this.translateService.instant('COMMON.GO_BACK'),
          role: 'cancel'
        },
        {
          text: this.translateService.instant('COMMON.YES')
        }
      ],
    });

    await alert.present();
    return alert.onDidDismiss();
  }

  private async failedVerification() {
    const alert = await this.alertController.create({
      header: this.translateService.instant('SIGNUP_ACCOUNT.VERIFICATION_FAILED'),
      message: this.translateService.instant('SIGNUP_ACCOUNT.VERIFICATION_FAILED_MSG'),
      buttons: [this.translateService.instant('COMMON.OK')],
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
