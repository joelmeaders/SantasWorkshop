import { Inject, Injectable, OnDestroy } from '@angular/core';
import { COLLECTION_SCHEMA, FireRepoLite, IDateTimeSlot, IFireRepoCollection, PreRegistrationService, PROGRAM_YEAR } from '@core/*';
import { Observable, Subject } from 'rxjs';
import { map, shareReplay, take, takeUntil } from 'rxjs/operators';

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
    return this.dateTimeSlotCollection().readMany<IDateTimeSlot>(
      (query) => query.where('programYear', '==', programYear)
                      .where('enabled', '==', true),
      'id'
    );
  }
}
