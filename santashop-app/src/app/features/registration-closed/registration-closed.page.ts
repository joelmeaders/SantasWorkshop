import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil, tap } from 'rxjs/operators';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'app-registration-closed',
  templateUrl: './registration-closed.page.html',
  styleUrls: ['./registration-closed.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegistrationClosedPage implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly isRegistrationEnabledSubscription = 
    this.service.isRegistrationEnabled$.pipe(
      takeUntil(this.destroy$),
      filter(enabled => enabled),
      tap(() => {
        console.log('registration enabled, navigating');
        this.router.navigate(['/']);
      })
    ).subscribe();

  constructor(
    public readonly service: AppStateService,
    private readonly router: Router
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
