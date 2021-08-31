import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
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

  constructor(
    private readonly viewService: SignUpPageService,
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService
  ) {}

  ionViewWillEnter() {
    setTimeout(() => this.firstName?.setFocus(), 300);
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
      header: this.translateService.instant('SIGNUP_ACCOUNT.CONFIRM_EMAIL'),
      subHeader: emailAddress,
      message: this.translateService.instant('SIGNUP_ACCOUNT.CONFIRM_EMAIL_MSG'),
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
    
}
