import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil, tap } from 'rxjs/operators';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
	selector: 'app-maintenance',
	templateUrl: './maintenance.page.html',
	styleUrls: ['./maintenance.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenancePage implements OnDestroy {
	private readonly destroy$ = new Subject<void>();

	public readonly isMaintenanceDisabledSubscription =
		this.service.isMaintenanceModeEnabled$
			.pipe(
				takeUntil(this.destroy$),
				filter((enabled) => !enabled),
				tap(() => {
					console.log('maintenance disabled, navigating');
					this.router.navigate(['/']);
				})
			)
			.subscribe();

	constructor(
		public readonly service: AppStateService,
		private readonly router: Router
	) {}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}
}
