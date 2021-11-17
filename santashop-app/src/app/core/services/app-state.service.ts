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
    this.configService.maintenanceModeEnabled$;
  public readonly isRegistrationEnabled$ =
    this.configService.registrationEnabled$;
  public readonly shopClosedWeather$ = this.configService.shopClosedWeather$;

  public readonly maintenance = this.isMaintenanceModeEnabled$.pipe(
    takeUntil(this.destroy$)
  );

  public readonly registrationClosed = this.isRegistrationEnabled$.pipe(
    takeUntil(this.destroy$)
  );

  public readonly shopClosedWeather = this.shopClosedWeather$.pipe(
    takeUntil(this.destroy$)
  );

  public readonly appClosureSubscription = combineLatest([
    this.maintenance,
    this.shopClosedWeather,
    this.registrationClosed,
  ])
    .pipe(
      tap(([maintenance, weather, registration]) => {

        if (window.location.hostname === 'localhost')
          return;

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
