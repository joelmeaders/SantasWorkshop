import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { shareReplay } from 'rxjs/operators';
import { PrivacyPolicyModalComponent } from '../../../shared/components/privacy-policy-modal/privacy-policy-modal.component';
import { TermsOfServiceModalComponent } from '../../../shared/components/terms-of-service-modal/terms-of-service-modal.component';
import { SignUpPageService } from './sign-up.page.service';

@Component({
  selector: 'app-sign-up',
  templateUrl: './sign-up.page.html',
  styleUrls: ['./sign-up.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SignUpPageService],
})
export class SignUpPage {
  public readonly form = this.viewService.form;

  @ViewChild('firstName') firstName?: HTMLIonInputElement;
  @ViewChild('captchaRef') captchaRef: ReCaptchaV2.ReCaptcha | null = null;

  public readonly recaptchaValid$ = this.viewService.recaptchaValid$.asObservable().pipe(
    shareReplay(1)
  );

  constructor(
    private readonly viewService: SignUpPageService,
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService,
    private readonly modalController: ModalController
  ) { }

  ionViewWillEnter() {
    setTimeout(() => this.firstName?.setFocus(), 300);
  }

  public async onValidateRecaptcha($event: any) {
    await this.viewService.onValidateRecaptcha($event);
  }

  public async onCreateAccount(): Promise<void> {
    if (await this.userConfirmedEmail())
      await this.viewService.onboardUser();
  }

  private async userConfirmedEmail(): Promise<boolean> {

    const emailAddress = this.form.controls.emailAddress.value;

    if (!emailAddress)
      return false;
    
    const alert = await this.alertController.create({
      header: this.translateService.instant('SIGNUP.CONFIRM_EMAIL'),
      subHeader: emailAddress,
      message: this.translateService.instant('SIGNUP.CONFIRM_EMAIL_MSG'),
      buttons: [
        {
          text: this.translateService.instant('COMMON.GO_BACK'),
          role: 'cancel'
        },
        {
          text: this.translateService.instant('COMMON.YES'),
          role: 'confirm'
        }
      ],
    });

    await alert.present();
    const shouldContinue = await alert.onDidDismiss();
    return shouldContinue.role === 'confirm'
  }

  public async showPrivacyPolicyModal() {
    const modal = await this.modalController.create({
      component: PrivacyPolicyModalComponent,
    });
    return modal.present();
  }

  public async showTermsConditionsModal() {
    const modal = await this.modalController.create({
      component: TermsOfServiceModalComponent,
    });
    return modal.present();
  }
    
}
