import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { combineLatest, Subject } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { RemoteConfigService } from './remote-config.service';

@Injectable({
  providedIn: 'root',
})
export class AppStateService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  public readonly isMaintenanceModeEnabled$ =
    this.configService.maintenanceModeEnabled$.pipe(takeUntil(this.destroy$));

  public readonly isRegistrationEnabled$ =
    this.configService.registrationEnabled$.pipe(takeUntil(this.destroy$));

  public readonly shopClosedWeather$ =
    this.configService.shopClosedWeather$.pipe(takeUntil(this.destroy$));

  public readonly appClosureSubscription = combineLatest([
    this.isMaintenanceModeEnabled$,
    this.shopClosedWeather$,
    this.isRegistrationEnabled$,
  ])
    .pipe(
      tap(([maintenance, weather, registration]) => {
        // TODO: Change window to an injected service for testability
        if (window.location.hostname === 'localhost:4100') return;

        if (maintenance) {
          this.router.navigate(['/maintenance']);
          console.log('maintenance');
          return;
        }

        if (weather) {
          this.router.navigate(['/bad-weather']);
          console.log('weather');
          return;
        }

        if (!registration) {
          this.router.navigate(['/registration-closed']);
          console.log('registration');
        }
      })
    )
    .subscribe();

  constructor(
    private readonly configService: RemoteConfigService,
    private readonly router: Router
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
