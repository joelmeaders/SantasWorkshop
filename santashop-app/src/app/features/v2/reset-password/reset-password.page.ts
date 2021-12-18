import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/compat/analytics';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '@core/*';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordPage {

  public readonly form: FormGroup = this.formBuilder.group({
    emailAddress: [undefined, Validators.compose([Validators.required, Validators.email])]
  });
  
  @ViewChild('captchaRef') captchaRef: ReCaptchaV2.ReCaptcha | null = null;

  private readonly _resetEmailSent$ = new BehaviorSubject<boolean>(false);
  public readonly resetEmailSent$ = this._resetEmailSent$.asObservable().pipe(
    shareReplay(1)
  );

  private readonly _recaptchaValid$ = new BehaviorSubject<boolean>(false);
  public readonly recaptchaValid$ = this._recaptchaValid$.asObservable().pipe(
    shareReplay(1)
  );

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly afFunctions: Functions,
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService,
    private readonly analytics: AngularFireAnalytics
  ) {}

  public resetPage() {
    this.form.controls.emailAddress.setValue(undefined);
    this.form.markAsPristine();
    this._resetEmailSent$.next(false);
    this._recaptchaValid$.next(false);
    this.captchaRef?.reset();
  }

  public async onValidateRecaptcha($event: any) {
    if (!await this.validateRecaptcha($event)) {
      this._recaptchaValid$.next(false);
      await this.failedVerification();
      return;
    }

    await this.analytics.logEvent('validated_recaptcha');
    this._recaptchaValid$.next(true);
  }

  public async resetPassword() {

    if (!this._recaptchaValid$.getValue())
      return;

    const email = this.form.get('emailAddress')?.value;

    await this.analytics.logEvent('reset_password');

    await this.authService.resetPassword(email).then(() => {
      this._resetEmailSent$.next(true);
    });
  }

  private async validateRecaptcha($event: any): Promise<boolean> {
    const status = await httpsCallable(this.afFunctions, 'verifyRecaptcha2')({ value: $event })
    return Promise.resolve((<any>status.data).success);
  }

  // Move to UI service
  private async failedVerification() {
    const alert = await this.alertController.create({
      header: this.translateService.instant('COMMON.VERIFICATION_FAILED'),
      message: this.translateService.instant('COMMON.VERIFICATION_FAILED_MSG'),
      buttons: [this.translateService.instant('COMMON.OK')],
    });

    await alert.present();
  }
}
