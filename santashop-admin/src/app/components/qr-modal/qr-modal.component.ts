import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { of } from 'rxjs';
import { delay, publishReplay, refCount } from 'rxjs/operators';
import { CheckInService } from '../../services/check-in.service';

@Component({
  selector: 'app-qr-modal',
  templateUrl: './qr-modal.component.html',
  styleUrls: ['./qr-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QrModalComponent {

  public readonly $registration = this.checkInService.$registration;

  private readonly subscription = this.$registration.subscribe(async (value) => {
    console.log(value);
    await this.refresh();
  });

  constructor(
    private readonly modalController: ModalController,
    private readonly alertController: AlertController,
    private readonly checkInService: CheckInService,
    private readonly cd: ChangeDetectorRef
  ) { }

  public editRegistration() {
    
  }

  public async refresh() {
    of().pipe(delay(1000)).toPromise().then(() => {
      this.cd.detectChanges();
    });
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
