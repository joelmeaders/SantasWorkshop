import { Injectable } from '@angular/core';
import { Router, Event as NavigationEvent, NavigationEnd } from '@angular/router';
import { filter, map, publishReplay, refCount, switchMap, take } from 'rxjs/operators';
import { AuthService, FireCRUDStateless } from 'santashop-core/src/public-api';

@Injectable({
  providedIn: 'root',
})
export class MaintenanceService {
  private readonly PATH = 'parameters';
  private readonly DOCID = 'public';

  private readonly $publicParams = this.httpService
    .readOne(this.PATH, this.DOCID)
    .pipe(take(1));

  public readonly $isMaintenance = this.$publicParams.pipe(
    map((response: any) => response.maintenance as boolean),
    publishReplay(1),
    refCount()
  );

  public readonly $messageEn = this.$publicParams.pipe(
    map((response: any) => response.ennotification as string)
  );

  public readonly $messageEs = this.$publicParams.pipe(
    map((response: any) => response.esnotification as string)
  );

  // Force maintenance mode to activate when on
  public readonly navigationSub = this.router.events.pipe(
      filter((event: NavigationEvent) => event instanceof NavigationEnd),
      filter((event: NavigationEnd) => event.url !== '/maintenance'),
      switchMap(() => this.$isMaintenance),
      filter((response: boolean) => !!response),
      switchMap(() => this.authService.$IsAdminNoAuth),
      filter((response: boolean) => !response),
    ).subscribe(() => this.router.navigate(['/maintenance']));

  constructor(
    private readonly httpService: FireCRUDStateless,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}
}
