import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular';
import { ICheckIn } from '@models/*';
import { BehaviorSubject, from, Subject } from 'rxjs';
import { filter, mergeMap, publishReplay, refCount, take, takeUntil, tap } from 'rxjs/operators';
import { CheckInHelpers } from '../../helpers/checkin-helpers';
import { CheckInService } from '../../services/check-in.service';
import { Timestamp } from '@firebase/firestore';
import { RegistrationContextService } from '../../services/registration-context.service';

@Component({
  selector: 'app-qr-modal',
  templateUrl: './qr-modal.component.html',
  styleUrls: ['./qr-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QrModalComponent implements OnDestroy {

  private readonly $destroy = new Subject<void>();
  public readonly $loading = new BehaviorSubject<boolean>(true);

  public friendlyTimestamp = CheckInHelpers.friendlyTimestamp;
  public cardColor = CheckInHelpers.childColor;

  public readonly $registration = this.registrationContext.registration$.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  public readonly $existingCheckin = this.registrationContext.checkin$.pipe(
    takeUntil(this.$destroy),
    tap(() => this.$loading.next(false)),
    publishReplay(1),
    refCount()
  );

  private readonly existingAlertSubcription = this.$existingCheckin.pipe(
    takeUntil(this.$destroy),
    filter(response => !!response?.customerId),
    mergeMap(response => from(this.alreadyCheckedIn(response))),
  ).subscribe();

  constructor(
    private readonly registrationContext: RegistrationContextService,
    private readonly modalController: ModalController,
    private readonly alertController: AlertController,
    private readonly checkInService: CheckInService,
    private readonly router: Router
  ) { }

  ngOnDestroy() {
    // this.checkInService.reset();
    this.existingAlertSubcription.unsubscribe();
    this.$destroy.next();
  }

  public async editRegistration() {
    // TOOD: EDIT
    // const registration = await this.$registration.pipe(take(1)).toPromise();
    // this.checkInService.setRegistrationToEdit(registration);
    this.router.navigate(['/admin/register']);
    await this.modalController.dismiss();
  }

  public async checkIn() {

    const alert = await this.confirmCheckInAlert();
    await alert.present();
    const response = await alert.onDidDismiss().then(res => res.role);

    if (response !== 'confirm') {
      return;
    }

    const registration = await this.$registration.pipe(take(1)).toPromise();

    if (!registration) {
      // TODO: ERROR
      return;
    }

    try {
      await this.checkInService.checkIn(registration, false);
    }
    catch (error) {
      console.error(error);
      //TODO: Handle this shit
    }

    await this.modalController.dismiss(undefined, 'checkin');
  }

  private async confirmCheckInAlert() {
    return this.alertController.create({
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

  private async alreadyCheckedIn(checkin?: ICheckIn) {

    if (!checkin)
      return;

    const alert = await this.alertController.create({
      header: 'Existing Check-In',
      subHeader: CheckInHelpers.friendlyTimestamp(<any>checkin!.checkInDateTime as Timestamp),
      message: 'This registration code was already used on the date/time specified. Unable to continue.',
      buttons: [
        {
          text: 'Ok',
        }
      ]
    });

    await alert.present();

    return alert.onDidDismiss();
  }

  public async cancel() {
    await this.modalController.dismiss(undefined, 'cancel')
  }

}
