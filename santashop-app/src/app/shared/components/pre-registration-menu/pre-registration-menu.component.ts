import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, shareReplay } from 'rxjs/operators';
import { PreRegistrationService } from '../../../core';

@Component({
  selector: 'app-pre-registration-menu',
  templateUrl: './pre-registration-menu.component.html',
  styleUrls: ['./pre-registration-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreRegistrationMenuComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  public readonly childCount$ = this.viewService.childCount$.pipe(
    takeUntil(this.destroy$),
    shareReplay(1)
  );

  public readonly chosenSlot$ = this.viewService.dateTimeSlot$.pipe(
    takeUntil(this.destroy$),
    shareReplay(1)
  );

  public readonly isRegistrationComplete$ =
    this.viewService.registrationComplete$.pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );

  constructor(private readonly viewService: PreRegistrationService) {}

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
