import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { publishReplay, refCount, switchMap, map } from 'rxjs/operators';
import { StatsService } from 'santashop-admin/src/app/services/stats.service';

@Component({
  selector: 'app-stats',
  templateUrl: 'stats.page.html',
  styleUrls: ['stats.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatsPage implements OnDestroy {

  private readonly $destroy = new Subject<void>();

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

  public readonly $dateTimeStats = this.statsService.$dateTimeCounts.pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $zipCodeStats = this.statsService.$zipCodeCounts.pipe(
    publishReplay(1),
    refCount()
  );

  constructor(
    private readonly statsService: StatsService,
  ) { }

  public async ngOnDestroy() {
    this.$destroy.next();
  }
}
