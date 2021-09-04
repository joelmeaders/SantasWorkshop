import { Inject, Injectable, OnDestroy } from '@angular/core';
import { COLLECTION_SCHEMA, FireRepoLite, IDateTimeSlot, IFireRepoCollection, PreRegistrationService, PROGRAM_YEAR } from '@core/*';
import { Timestamp } from '@firebase/firestore';
import { Observable, Subject } from 'rxjs';
import { filter, map, shareReplay, take, takeUntil } from 'rxjs/operators';

@Injectable()
export class DateTimePageService implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly availableSlots$ =
    this.availableSlotsQuery(this.programYear).pipe(
      takeUntil(this.destroy$),
      // TODO: Make this map a shared reusable method
      map(data => {
        data.forEach(s => s.dateTime = (<any>s.dateTime as Timestamp).toDate())
        return data;
      }),
      map(data => data.slice()
        .sort((a,b) => a.dateTime.valueOf() - b.dateTime.valueOf())),
      shareReplay(1)
    );

  public readonly registrationSlot$: Observable<IDateTimeSlot> =
    this.preRegistrationService.userRegistration$.pipe(
      takeUntil(this.destroy$),
      map(registration => registration?.dateTimeSlot as IDateTimeSlot),
      filter(registration => !!registration),
      // TODO: Make this map a shared reusable method
      map(data => {
        data.dateTime = (<any>data.dateTime as Timestamp).toDate()
        return data;
      }),
      shareReplay(1)
    );

  constructor(
    @Inject(PROGRAM_YEAR) private readonly programYear: number,
    private readonly fireRepo: FireRepoLite,
    private readonly preRegistrationService: PreRegistrationService
  ) { }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public async updateRegistration(slot?: IDateTimeSlot) {
    
    if (!slot) {
      // TODO: Make error
      return;
    }

    const registration = 
      await this.preRegistrationService.userRegistration$.pipe(take(1)).toPromise();
    
    registration.dateTimeSlot = {
      dateTime: slot.dateTime,
      id: slot.id
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
    return this.dateTimeSlotCollection().readMany<IDateTimeSlot>(
      (query) => query.where('programYear', '==', programYear)
                      .where('enabled', '==', true),
      'id'
    );
  }
}
