import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { ProfileMigrationService } from 'santashop-core/src/public-api';
import { Subject } from 'rxjs';
import { takeUntil, shareReplay } from 'rxjs/operators';
import { PreRegistrationService } from '../../../core';

@Component({
	selector: 'app-pre-registration',
	templateUrl: './pre-registration.page.html',
	styleUrls: ['./pre-registration.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreRegistrationPage implements OnDestroy {
	private readonly destroy$ = new Subject<void>();

	public readonly userRegistration$ = this.viewService.userRegistration$.pipe(
		takeUntil(this.destroy$),
		shareReplay(1)
	);

	public readonly childCount$ = this.viewService.childCount$.pipe(
		takeUntil(this.destroy$),
		shareReplay(1)
	);

	public readonly chosenSlot$ = this.viewService.dateTimeSlot$.pipe(
		takeUntil(this.destroy$),
		shareReplay(1)
	);

	public readonly isRegistrationComplete$ =
		this.viewService.registrationComplete$.pipe(
			takeUntil(this.destroy$),
			shareReplay(1)
		);

	constructor(
		private readonly viewService: PreRegistrationService,
		public readonly migrationService: ProfileMigrationService // Entrypoint for migration service
	) {}

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}
}
