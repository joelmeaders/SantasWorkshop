import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { delay, filter, switchMap, takeUntil, tap } from 'rxjs/operators';
import { RemoteConfigService } from './remote-config.service';

@Injectable({
  providedIn: 'root',
})
export class AppStateService implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly isMaintenanceModeEnabled$ = this.configService.maintenanceModeEnabled$;
  public readonly isRegistrationEnabled$ = this.configService.registrationEnabled$;

  public readonly shopClosedWeather$ = this.configService.shopClosedWeather$;

  public readonly maintenanceRedirectSubscription = 
    this.isMaintenanceModeEnabled$.pipe(
      takeUntil(this.destroy$),
      filter(enabled => enabled),
      switchMap(() => of(delay(1000))),
      tap(() => this.router.navigate(['/maintenance']))
    ).subscribe();

  public readonly registrationClosedRedirectSubscription = 
    this.isRegistrationEnabled$.pipe(
      takeUntil(this.destroy$),
      filter(enabled => !enabled),
      switchMap(() => of(delay(1000))),
      tap(() => this.router.navigate(['/registration-closed']))
    ).subscribe();

  public readonly shopClosedWeatherRedirectSubscription = 
    this.shopClosedWeather$.pipe(
      takeUntil(this.destroy$),
      filter(enabled => enabled),
      switchMap(() => of(delay(1000))),
      tap(() => this.router.navigate(['/bad-weather']))
    ).subscribe();

  constructor(
    private readonly configService: RemoteConfigService,
    private readonly router: Router,
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
