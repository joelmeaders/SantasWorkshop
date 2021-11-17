import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil, tap } from 'rxjs/operators';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'app-bad-weather',
  templateUrl: './bad-weather.page.html',
  styleUrls: ['./bad-weather.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class BadWeatherPage implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly isShopClosedSubscription = 
    this.service.shopClosedWeather$.pipe(
      takeUntil(this.destroy$),
      filter(enabled => !enabled),
      tap(() => {
        console.log('weather disabled, navigating');
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