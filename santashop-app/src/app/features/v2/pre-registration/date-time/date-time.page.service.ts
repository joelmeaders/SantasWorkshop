import { Inject, Injectable, OnDestroy } from '@angular/core';
import { FireRepoLite, IFireRepoCollection, PreRegistrationService, PROGRAM_YEAR } from '@core/*';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import { map, shareReplay, takeUntil } from 'rxjs/operators';
import { Timestamp } from '@firebase/firestore';
import { COLLECTION_SCHEMA, IDateTimeSlot } from '@models/*';

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

  public readonly registrationSlot$ = 
    this.preRegistrationService.dateTimeSlot$.pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
  );

  constructor(
    @Inject(PROGRAM_YEAR) private readonly programYear: number,
    private readonly fireRepo: FireRepoLite,
    private readonly preRegistrationService: PreRegistrationService,
  ) { }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public async updateRegistration(slot?: IDateTimeSlot) {
    
    const registration = 
      await firstValueFrom(this.preRegistrationService.userRegistration$);

    if (!slot) {
      delete registration.dateTimeSlot;
    } 
    else {
      registration.dateTimeSlot = {
        dateTime: slot.dateTime,
        id: slot.id
      };
    }

    // TODO: Error handling
    const storeRegistration = 
      firstValueFrom(this.preRegistrationService.saveRegistration(registration));
    
    try {
      await storeRegistration;
    } 
    catch (error) 
    { 
      console.error(error)
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
