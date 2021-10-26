import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
// import { AuthService } from '@core/*';
import { ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { filter, takeUntil, tap } from 'rxjs/operators';
import { RemoteConfigService } from './remote-config.service';

@Injectable({
  providedIn: 'root',
})
export class AppStateService implements OnDestroy {

  // TODO: Remove commented code for prod

  private readonly destroy$ = new Subject<void>();
  // private readonly maintenanceAdminMessage = 
  //   `This app is in maintenance mode. As an admin, you can continue using it.`;

  // private readonly registrationDisabledAdminMessage = 
  //   `Registrations are closed. As an admin, you can continue using this app.`;

  public readonly isMaintenanceModeEnabled$ = this.configService.maintenanceModeEnabled$;
  public readonly isRegistrationEnabled$ = this.configService.registrationEnabled$;

  public readonly maintenanceRedirectSubscription = 
    this.isMaintenanceModeEnabled$.pipe(
      takeUntil(this.destroy$),
      filter(enabled => !!enabled),
      // switchMap(() => this.authService.isAdmin$),
      // tap(async isAdmin => this.adminToast(isAdmin, this.maintenanceAdminMessage)),
      // filter(isAdmin => !isAdmin),
      tap(() => this.router.navigate(['/maintenance']))
    ).subscribe();

  public readonly registrationClosedRedirectSubscription = 
    this.isRegistrationEnabled$.pipe(
      takeUntil(this.destroy$),
      filter(enabled => !enabled),
      // switchMap(() => this.authService.isAdmin$),
      // tap(async isAdmin => this.adminToast(isAdmin, this.registrationDisabledAdminMessage)),
      // filter(isAdmin => !isAdmin),
      tap(() => this.router.navigate(['/registration-closed']))
    ).subscribe();

  constructor(
    private readonly configService: RemoteConfigService,
    // private readonly authService: AuthService,
    private readonly router: Router,
    private readonly toastController: ToastController
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public async adminToast(isAdmin: boolean, message: string) {

    if (!isAdmin)
      return;

    const toast = await this.toastController.create({
      header: 'Administrative Alert',
      message: message,
      duration: 5000
    });

    toast.present();
  }
}
