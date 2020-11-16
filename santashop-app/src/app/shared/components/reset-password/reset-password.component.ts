import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController, ModalController } from '@ionic/angular';
import { AuthService } from 'santashop-core/src/public-api';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent {

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly alertController: AlertController,
    private readonly modalController: ModalController
  ) {}

  public readonly form: FormGroup = this.formBuilder.group({
    emailAddress: [undefined, Validators.compose([Validators.required, Validators.email])]
  });

  public async resetPassword() {
    const email = this.form.get('emailAddress').value;

    const alert = await this.alertController.create({
      header: 'Success',
      subHeader: 'Request received',
      message:
        'You should receive an email with a link to reset your password in a couple of minutes. If you do not see the email check your spam folder.',
      buttons: ['OK']
    });

    await this.authService.resetPassword(email).then(async () => {
      await alert.present();
      await alert.onDidDismiss().then(async () => {
        await this.modalController.dismiss();
      });
    });
  }

  public async cancel() {
    await this.modalController.dismiss();
  }
}
