import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { IDateTimeSlot } from '@models/*';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { shareReplay, take, map, takeUntil } from 'rxjs/operators';
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
      shareReplay(1)
    );

  constructor(
    private readonly viewService: DateTimePageService,
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService
  ) { }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public async selectDateTime(slot?: IDateTimeSlot) {

    const hasSlot = await this.alreadyChoseSlot();
    var shouldChange = false;

    if (hasSlot)
      shouldChange = await this.confirmChangeDate();

    if (!hasSlot || shouldChange)
      await this.viewService.updateRegistration(slot);

    // TODO: SHow msg and ask to move to next step
  }

  private alreadyChoseSlot(): Promise<boolean> {
    return this.chosenSlot$.pipe(
      take(1),
      map(slot => !!slot)
    ).toPromise();
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
