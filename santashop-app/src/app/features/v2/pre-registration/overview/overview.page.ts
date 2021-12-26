import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { combineLatest, Subject } from 'rxjs';
import { filter, map, shareReplay, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { PreRegistrationService } from '../../../../core';

@Component({
  selector: 'app-overview',
  templateUrl: './overview.page.html',
  styleUrls: ['./overview.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewPage implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly userRegistration$ = this.preregistrationService.userRegistration$;
  public readonly children$ = this.preregistrationService.children$;
  public readonly childCount$ = this.preregistrationService.childCount$;
  public readonly dateTimeSlot$ = this.preregistrationService.dateTimeSlot$;
  public readonly registrationSubmitted$ = this.preregistrationService.registrationSubmitted$;

  public readonly canChooseDateTime$ = this.childCount$.pipe(
    startWith(0),
    takeUntil(this.destroy$),
    map(value => value >= 1),
    filter(isTrue => !!isTrue),
    switchMap(() => this.preregistrationService.noErrorsInChildren$),
    filter(errorFree => !!errorFree),
    shareReplay(1)
  );

  public readonly canSubmit$ = combineLatest([
    this.childCount$,
    this.dateTimeSlot$
  ]).pipe(
    takeUntil(this.destroy$),
    map(([childCount, dateTimeSlot]) => childCount >= 1 && !!dateTimeSlot),
    shareReplay(1)
  );

  constructor(
    private readonly preregistrationService: PreRegistrationService,
  ) { }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
