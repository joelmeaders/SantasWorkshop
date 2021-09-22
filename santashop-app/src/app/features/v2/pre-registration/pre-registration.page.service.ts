import { Injectable, OnDestroy } from '@angular/core';
import { PreRegistrationService } from '@core/*';
import { Subject } from 'rxjs';
import { shareReplay, takeUntil } from 'rxjs/operators';

@Injectable()
export class PreRegistrationPageService implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly childCount$ = 
    this.preregistrationService.childCount$.pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );

  public readonly chosenSlot$ = 
    this.preregistrationService.dateTimeSlot$.pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );

  public readonly isRegistrationComplete$ = 
    this.preregistrationService.registrationComplete$.pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );

  constructor(
    private readonly preregistrationService: PreRegistrationService
  ) { }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
