import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { CheckInService } from 'app/shared/services/check-in.service';

@Component({
  selector: 'app-qr-modal',
  templateUrl: './qr-modal.component.html',
  styleUrls: ['./qr-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QrModalComponent implements OnInit {

  constructor(
    private readonly modalController: ModalController,
    private readonly alertController: AlertController,
    public readonly checkInService: CheckInService
  ) { }

  ngOnInit() {}

  public editRegistration() {

  }

  public async checkIn() {

    const alert = await this.confirmCheckInAlert();
    await alert.present();
    const response = await alert.onDidDismiss().then(res => res.role);

    if (response !== 'confirm') {
      return;
    }

    await this.checkInService.saveCheckIn().then(response => {
      this.checkInService.reset();
      this.dismiss();
    });
  }

  private async confirmCheckInAlert() {
    return await this.alertController.create({
      header: 'Confirm Action',
      subHeader: 'A check-in cannot be undone',
      message: 'Are you sure there are no changes? Once checked in, the customer code is no longer valid',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        }, {
          text: 'Confirm',
          role: 'confirm'
        }
      ]
    });
  }
  public async dismiss() {
    await this.modalController.dismiss();
  }

}
