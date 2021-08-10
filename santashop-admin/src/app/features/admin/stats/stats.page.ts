import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { BehaviorSubject, forkJoin, Subject } from 'rxjs';
import { publishReplay, refCount, switchMap, map } from 'rxjs/operators';
import { ManualOperationsService } from 'santashop-admin/src/app/services/manual-operations.service';
import { StatsService } from 'santashop-admin/src/app/services/stats.service';

@Component({
  selector: 'app-stats',
  templateUrl: 'stats.page.html',
  styleUrls: ['stats.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatsPage implements OnDestroy {

  private readonly $destroy = new Subject<void>();

  private readonly _$view = new BehaviorSubject<'registration' | 'checkin'>('registration');
  public readonly $view = this._$view.pipe(
    publishReplay(1),
    refCount()
  );

  public readonly now = new Date().toLocaleString();

  public readonly $customers = this.statsService.customers().pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $registrations = this.statsService.$completedRegistrations.pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $children = this.statsService.children().pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $childrenPerCustomer = this.$children.pipe(
    switchMap(children => this.$customers.pipe(
      map(customers => (children / customers).toFixed(2))
    )),
    publishReplay(1),
    refCount()
  );

  public readonly $dateTimeStats = this.statsService.$registrationDateTimeCounts.pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $zipCodeStats = this.statsService.$zipCodeCounts.pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $checkInLastUpdated = this.statsService.$checkInLastUpdated.pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $checkInDateTimeCounts = this.statsService.$checkInDateTimeCounts.pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $checkInTotalCustomerCount = this.statsService.$checkInTotalCustomerCount.pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $checkInTotalChildCount = this.statsService.$checkInTotalChildCount.pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $checkInTotalPreregisteredCount = this.statsService.$checkInTotalPreregisteredCount.pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $checkInOnSiteRegistration = forkJoin([
    this.$checkInTotalCustomerCount,
    this.$checkInTotalPreregisteredCount
  ]).pipe(
    map(([total, prereg]) => total - prereg),
    publishReplay(1),
    refCount()
  );

  public readonly $checkInTotalModifiedCount = this.statsService.$checkInTotalModifiedCount.pipe(
    publishReplay(1),
    refCount()
  );

  constructor(
    private readonly statsService: StatsService,
    private readonly manualService: ManualOperationsService
  ) { }

  public async manualAgeStats() {
    await this.manualService.aggregateAgeGroups();
  }

  public async ngOnDestroy() {
    this.$destroy.next();
  }

  public changeView(value: 'registration' | 'checkin') {
    this._$view.next(value);
  }
}
