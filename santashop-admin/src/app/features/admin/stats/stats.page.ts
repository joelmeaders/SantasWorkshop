import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { BehaviorSubject, forkJoin, Subject } from 'rxjs';
import { switchMap, map, shareReplay } from 'rxjs/operators';
import { StatsService } from 'santashop-admin/src/app/services/stats.service';

@Component({
	selector: 'app-stats',
	templateUrl: 'stats.page.html',
	styleUrls: ['stats.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPage implements OnDestroy {
	private readonly destroy$ = new Subject<void>();

	private readonly view = new BehaviorSubject<'registration' | 'checkin'>(
		'registration'
	);
	public readonly $view = this.view.asObservable();

	public readonly now = new Date().toLocaleString();

	public readonly $registrations =
		this.statsService.$completedRegistrations.pipe(
			shareReplay(1)
		);

	public readonly $children = this.statsService.$registeredChildrenCount.pipe(
			shareReplay(1)
	);

	public readonly $childrenPerRegistration = this.$children.pipe(
		switchMap((children) =>
			this.$registrations.pipe(
				map((customers) => (children / customers).toFixed(2))
			)
		),
			shareReplay(1)
	);

	public readonly $dateTimeStats =
		this.statsService.$registrationDateTimeCounts.pipe(
			shareReplay(1)
		);

	public readonly $typeAgeStats =
		this.statsService.$registrationGenderAgeByDateCounts.pipe(
			shareReplay(1)
		);

	public readonly $zipCodeStats = this.statsService.$zipCodeCounts.pipe(
			shareReplay(1)
	);

	public readonly $checkInLastUpdated =
		this.statsService.$checkInLastUpdated.pipe(
			shareReplay(1)
		);

	public readonly $checkInDateTimeCounts =
		this.statsService.$checkInDateTimeCounts.pipe(
			shareReplay(1)
		);

	public readonly $checkInTotalCustomerCount =
		this.statsService.checkInTotalCustomerCount$.pipe(
			shareReplay(1)
		);

	public readonly $checkInTotalChildCount =
		this.statsService.checkInTotalChildCount$.pipe(
			shareReplay(1)
		);

	public readonly $checkInTotalPreregisteredCount =
		this.statsService.$checkInTotalPreregisteredCount.pipe(
			shareReplay(1)
		);

	public readonly $checkInOnSiteRegistration = forkJoin([
		this.$checkInTotalCustomerCount,
		this.$checkInTotalPreregisteredCount,
	]).pipe(
		map(([total, prereg]) => total - prereg!),
			shareReplay(1)
	);

	public readonly $checkInTotalModifiedCount =
		this.statsService.$checkInTotalModifiedCount.pipe(
			shareReplay(1)
		);

	constructor(
		private readonly statsService: StatsService // private readonly manualService: ManualOperationsService
	) {}

	public async manualAgeStats() {
		// await this.manualService.aggregateAgeGroups();
	}

	public async ngOnDestroy() {
		this.destroy$.next();
	}

	public changeView($event: any) {
		const value: 'registration' | 'checkin' = $event.detail.value;
		this.view.next(value);
	}
}
