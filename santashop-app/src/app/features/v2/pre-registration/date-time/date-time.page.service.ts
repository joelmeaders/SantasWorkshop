import { Inject, Injectable, OnDestroy } from '@angular/core';
import { COLLECTION_SCHEMA, DEMO_MODE, FireRepoLite, IDateTimeSlot, IFireRepoCollection, PROGRAM_YEAR } from '@core/*';
import { Observable, of, Subject } from 'rxjs';
import { map, shareReplay, take, takeUntil } from 'rxjs/operators';
import { dateToTimestamp } from 'santashop-core/src/lib/helpers/dateTIme';
import { PreRegistrationService } from '../../../../core/services/pre-registration.service';

@Injectable()
export class DateTimePageService implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly availableSlots$ =
    this.availableSlotsQuery(this.programYear).pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );

  public readonly registrationSlot$: Observable<IDateTimeSlot | undefined> =
    this.preRegistrationService.userRegistration$.pipe(
      takeUntil(this.destroy$),
      map(registration => registration?.dateTimeSlot as IDateTimeSlot ?? undefined),
      shareReplay(1)
    );

  constructor(
    @Inject(DEMO_MODE) private readonly isDemo: boolean,
    @Inject(PROGRAM_YEAR) private readonly programYear: number,
    private readonly fireRepo: FireRepoLite,
    private readonly preRegistrationService: PreRegistrationService
  ) { }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public async updateRegistration(slot?: IDateTimeSlot) {
    const registration = 
      await this.preRegistrationService.userRegistration$.pipe(take(1)).toPromise();
    
    registration.dateTimeSlot = {
      dateTime: slot!.dateTime,
      id: slot!.id
    };
    
    // TODO: Error handling
    const storeRegistration = 
      this.preRegistrationService.saveRegistration(registration)
        .pipe(take(1)).toPromise();
    
    try {
      await storeRegistration;
    } 
    catch (error) 
    { 
      // Do something
    }
  }

  private dateTimeSlotCollection(): IFireRepoCollection {
    return this.fireRepo.collection(COLLECTION_SCHEMA.dateTimeSlots);
  }

  /**
   * Returns all time slots for the specified program year
   * where the field 'enabled' is true.
   *
   * @private
   * @param {number} programYear
   * @return {*}  {Observable<IDateTimeSlot[]>}
   * @memberof DateTimePageService
   */
  private availableSlotsQuery(programYear: number): Observable<IDateTimeSlot[]> {
    
    if (!this.isDemo)
      return this.dateTimeSlotCollection().readMany<IDateTimeSlot>(
        (query) => query.where('programYear', '==', programYear)
                        .where('enabled', '==', true),
        'id'
      );

    const demoValue: IDateTimeSlot[] = [
      { id: "1", programYear: programYear, dateTime: dateToTimestamp(new Date("12-10-2021 09:00")), maxSlots: 40, enabled: true },
      { id: "2", programYear: programYear, dateTime: dateToTimestamp(new Date("12-10-2021 10:00")), maxSlots: 40, enabled: true },
      { id: "3", programYear: programYear, dateTime: dateToTimestamp(new Date("12-10-2021 11:00")), maxSlots: 40, enabled: true },
      { id: "4", programYear: programYear, dateTime: dateToTimestamp(new Date("12-10-2021 12:00")), maxSlots: 40, enabled: true },
      { id: "5", programYear: programYear, dateTime: dateToTimestamp(new Date("12-10-2021 13:00")), maxSlots: 40, enabled: true },
      { id: "6", programYear: programYear, dateTime: dateToTimestamp(new Date("12-10-2021 14:00")), maxSlots: 40, enabled: true },
      { id: "7", programYear: programYear, dateTime: dateToTimestamp(new Date("12-10-2021 15:00")), maxSlots: 40, enabled: true },

      { id: "8", programYear: programYear, dateTime: dateToTimestamp(new Date("12-11-2021 09:00")), maxSlots: 40, enabled: true },
      { id: "9", programYear: programYear, dateTime: dateToTimestamp(new Date("12-11-2021 10:00")), maxSlots: 40, enabled: true },
      { id: "10", programYear: programYear, dateTime: dateToTimestamp(new Date("12-11-2021 11:00")), maxSlots: 40, enabled: true },
      { id: "11", programYear: programYear, dateTime: dateToTimestamp(new Date("12-11-2021 12:00")), maxSlots: 40, enabled: true },
      { id: "12", programYear: programYear, dateTime: dateToTimestamp(new Date("12-11-2021 13:00")), maxSlots: 40, enabled: true },
      { id: "13", programYear: programYear, dateTime: dateToTimestamp(new Date("12-11-2021 14:00")), maxSlots: 40, enabled: true },
      { id: "14", programYear: programYear, dateTime: dateToTimestamp(new Date("12-11-2021 15:00")), maxSlots: 40, enabled: true },

      { id: "15", programYear: programYear, dateTime: dateToTimestamp(new Date("12-12-2021 09:00")), maxSlots: 40, enabled: true },
      { id: "16", programYear: programYear, dateTime: dateToTimestamp(new Date("12-12-2021 10:00")), maxSlots: 40, enabled: true },
      { id: "17", programYear: programYear, dateTime: dateToTimestamp(new Date("12-12-2021 11:00")), maxSlots: 40, enabled: true },
      { id: "18", programYear: programYear, dateTime: dateToTimestamp(new Date("12-12-2021 12:00")), maxSlots: 40, enabled: true },
      { id: "19", programYear: programYear, dateTime: dateToTimestamp(new Date("12-12-2021 13:00")), maxSlots: 40, enabled: true },
      { id: "20", programYear: programYear, dateTime: dateToTimestamp(new Date("12-12-2021 14:00")), maxSlots: 40, enabled: true },
      { id: "21", programYear: programYear, dateTime: dateToTimestamp(new Date("12-12-2021 15:00")), maxSlots: 40, enabled: true },
    ];

    return of(demoValue);
  }
}
