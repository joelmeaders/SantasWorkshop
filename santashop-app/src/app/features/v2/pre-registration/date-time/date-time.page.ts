import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/compat/analytics';
import { SkeletonStateService } from '@core/*';
import { AlertController } from '@ionic/angular';
import { IDateTimeSlot } from '@models/*';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subject } from 'rxjs';
import { shareReplay, take, map, takeUntil, tap } from 'rxjs/operators';
import { DateTimePageService } from './date-time.page.service';

@Component({
  selector: 'app-date-time',
  templateUrl: './date-time.page.html',
  styleUrls: ['./date-time.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ DateTimePageService ]
})
export class DateTimePage implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly availableSlots$ =
    this.viewService.availableSlots$.pipe(
      takeUntil(this.destroy$),
      map(slots => slots.filter(slot => slot.enabled)),
      shareReplay(1)
    );

  public readonly availableDays$ = 
    this.availableSlots$.pipe(
      takeUntil(this.destroy$),
      map(slots => slots.map(slot => Date.parse(slot.dateTime.toDateString()))),
      map(dates => [...new Set(dates)]),
      tap(() => this.dateTimeSlotsState.setState(true)),
      shareReplay(1)
    );

  public readonly availableSlotsByDay$ = (date: number) =>
    this.availableSlots$.pipe(
      takeUntil(this.destroy$),
      map(slots => slots.filter(slot => Date.parse(slot.dateTime.toDateString()) === date)),
      shareReplay(1)
    );

  public readonly chosenSlot$ =
    this.viewService.registrationSlot$.pipe(
      takeUntil(this.destroy$),
      tap(() => this.dateTimeSlotState.setState(true)),
      shareReplay(1)
    );

  public readonly dateTimeSlotState =
    this.skeletonState.getState('dateTimeSlot', 'dateTimePage');

  public readonly dateTimeSlotsState =
    this.skeletonState.getState('dateTimeSlots', 'dateTimePage');

  constructor(
    private readonly viewService: DateTimePageService,
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService,
    private readonly analytics: AngularFireAnalytics,
    public readonly skeletonState: SkeletonStateService
    ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ionViewDidLeave() {
    this.skeletonState.removeStatesByGroup('dateTimePage');
  }

  public async selectDateTime(slot?: IDateTimeSlot) {

    const hasSlot = await this.alreadyChoseSlot();
    var shouldChange = false;

    if (hasSlot)
      shouldChange = await this.confirmChangeDate();

    if (shouldChange)
      await this.analytics.logEvent('cancelled_datetime');

    if (!hasSlot || shouldChange) {
      await this.analytics.logEvent('chose_datetime');
      await this.viewService.updateRegistration(slot);
    }
  }

  public spotsRemaining(slot: IDateTimeSlot): string {

    const slots = slot.maxSlots - (slot.slotsReserved ?? 0);

    if (!slot.enabled || slots <= 0)
      return 'Unavailable';

    return slots === 1 
      ? `${slots} spot`
      : `${slots} spots`;
  }

  private alreadyChoseSlot(): Promise<boolean> {
    var source = this.chosenSlot$.pipe(
      take(1),
      map(slot => !!slot)
    );
    return firstValueFrom(source);
  }

  private async confirmChangeDate(): Promise<boolean> {

    const alert = await this.alertController.create({
      // TODO: This stuff
      header: this.translateService.instant('Confirm Changes'),
      subHeader: this.translateService.instant('Are you sure you want to do this?'),
      message: this.translateService.instant('The slot you already have may no longer be available if you continue.'),
      buttons: [
        {
          text: 'Go Back',
          role: 'cancel'
        },
        {
          text: 'Continue'
        }
      ]
    });

    await alert.present();

    return alert.onDidDismiss()
      .then(e => e.role != 'cancel');
  }

}
