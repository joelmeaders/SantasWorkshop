import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { LoadingController, AlertController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil, publishReplay, refCount, switchMap, map, tap } from 'rxjs/operators';
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

  private readonly _$loading = new Subject<boolean>();
  public readonly $loading = this._$loading.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  public readonly $customers = this.statsService.customers().pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $registrations = this.statsService.registrations().pipe(
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

  constructor(
    private readonly statsService: StatsService,
    private readonly loadingController: LoadingController,
    private readonly alertController: AlertController
  ) { }

  public async ngOnDestroy() {
    this.$destroy.next();
  }

  private async destroyLoading() {
    await this.loadingController.dismiss();
  }
}
