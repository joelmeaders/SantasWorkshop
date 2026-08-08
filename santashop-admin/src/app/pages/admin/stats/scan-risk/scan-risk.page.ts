import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PROGRAM_YEAR } from '@santashop/core';
import {
	IonBadge,
	IonButton,
	IonContent,
	IonItem,
	IonLabel,
	IonList,
	IonSpinner,
} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, map, of, startWith, switchMap } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { ScanRiskService } from '../../../../shared/services/scan-risk.service';

@Component({
	selector: 'admin-scan-risk',
	templateUrl: './scan-risk.page.html',
	styleUrls: ['./scan-risk.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AsyncPipe,
		DatePipe,
		HeaderComponent,
		IonBadge,
		IonButton,
		IonContent,
		IonItem,
		IonLabel,
		IonList,
		IonSpinner,
		RouterLink,
	],
})
export class ScanRiskPage {
	private readonly service = inject(ScanRiskService);
	private readonly programYear = inject(PROGRAM_YEAR);
	private readonly pageSize = new BehaviorSubject<number>(20);

	public readonly state$ = this.pageSize.pipe(
		switchMap((pageSize) =>
			this.service.summaries(this.programYear, pageSize + 1).pipe(
				map((summaries) => ({
					status: 'ready' as const,
					summaries: summaries.slice(0, pageSize),
					hasMore: summaries.length > pageSize,
				})),
				startWith({ status: 'loading' as const }),
				catchError(() => of({ status: 'error' as const })),
			),
		),
	);

	public loadMore(): void {
		this.pageSize.next(this.pageSize.value + 20);
	}
}
