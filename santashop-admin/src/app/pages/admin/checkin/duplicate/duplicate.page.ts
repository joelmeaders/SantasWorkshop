import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AnalyticsWrapper } from '@santashop/core';
import type { ResolveRegistrationScanResult } from '@santashop/models';
import { IonButton, IonContent, IonItem, IonLabel, IonList } from '@ionic/angular';
import { filter, map, tap } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';

type BlockedScanResult = Extract<
	ResolveRegistrationScanResult,
	{ disposition: 'duplicate-accidental' | 'duplicate-risk' | 'cancelled' }
>;

const asDate = (value: unknown): Date | undefined => {
	if (value instanceof Date) return value;
	if (
		typeof value === 'object' &&
		value !== null &&
		'toDate' in value &&
		typeof value.toDate === 'function'
	) {
		return value.toDate() as Date;
	}
	return undefined;
};

@Component({
	selector: 'admin-duplicate',
	templateUrl: './duplicate.page.html',
	styleUrls: ['./duplicate.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		HeaderComponent,
		AsyncPipe,
		DatePipe,
		IonButton,
		IonContent,
		IonItem,
		IonLabel,
		IonList,
	],
})
export class DuplicatePage {
	private readonly context = inject(CheckInContextService);
	private readonly router = inject(Router);
	private readonly analytics = inject(AnalyticsWrapper);

	public readonly result$ = this.context.blockedScan$.pipe(
		filter((result): result is BlockedScanResult =>
			Boolean(
				result &&
					(result.disposition === 'duplicate-accidental' ||
						result.disposition === 'duplicate-risk' ||
						result.disposition === 'cancelled'),
			),
		),
		map((result) => ({
			...result,
			attempt: {
				...result.attempt,
				scannedOn: asDate(result.attempt.scannedOn),
				priorEventOn: asDate(result.attempt.priorEventOn),
			},
		})),
		tap((result) => {
			this.analytics.logEventWithParams('admin_blocked_scan_view', {
				disposition: result.disposition,
			});
		}),
		takeUntilDestroyed(),
	);

	public async startOver(): Promise<void> {
		this.context.reset();
		await this.router.navigate(['/admin/checkin/scan']);
	}
}
