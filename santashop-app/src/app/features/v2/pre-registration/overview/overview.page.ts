import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { PreRegistrationService } from '@core/*';
import { PopoverController } from '@ionic/angular';
import { combineLatest, Subject } from 'rxjs';
import { map, shareReplay, startWith, takeUntil } from 'rxjs/operators';
import { PublicMenuComponent } from '../../../../shared/components/public-menu/public-menu.component';

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
    private readonly popoverController: PopoverController
  ) { }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public async menu($event: any) {
    const popover = await this.popoverController.create({
      component: PublicMenuComponent,
      event: $event,
      translucent: true
    });
    await popover.present();
  }
}
