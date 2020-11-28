import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { delay, mergeMap, publishReplay, refCount, takeUntil, tap } from 'rxjs/operators';
import { ICheckIn } from 'santashop-core/src/lib/models';
import { CheckInService } from '../../services/check-in.service';

@Component({
  selector: 'app-qr-modal',
  templateUrl: './qr-modal.component.html',
  styleUrls: ['./qr-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QrModalComponent implements OnDestroy {

  private readonly $destroy = new Subject<void>();
  public readonly $loading = new BehaviorSubject<boolean>(true);

  public readonly $registration = this.checkInService.$registration.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  public readonly $existingCheckin = this.checkInService.$checkinRecord.pipe(
    takeUntil(this.$destroy),
    mergeMap(v => of(v).pipe(delay(3000))),
    tap(() => this.$loading.next(false)),
    publishReplay(1),
    refCount()
  );

  constructor(
    private readonly modalController: ModalController,
    private readonly alertController: AlertController,
    private readonly checkInService: CheckInService,
  ) { }

  ngOnDestroy() {
    this.$destroy.next();
  }

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

  private async alreadyCheckedIn(checkin: ICheckIn) {
    return await this.alertController.create({
      header: 'Existing Check-In',
      subHeader: checkin.checkInDateTime.toLocaleDateString(),
      message: 'This registration code was already used on the date/time specified. Unable to continue.',
      buttons: [
        {
          text: 'Ok',
        }
      ]
    });
  }

  public async dismiss() {
    await this.modalController.dismiss();
  }

}
