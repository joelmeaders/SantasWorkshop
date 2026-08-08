import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PROGRAM_YEAR } from '@santashop/core';
import { IonContent, IonItem, IonLabel, IonList, IonSpinner } from '@ionic/angular';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { ScanRiskService } from '../../../../shared/services/scan-risk.service';

@Component({
	selector: 'admin-scan-risk-detail',
	templateUrl: './scan-risk-detail.page.html',
	styleUrls: ['./scan-risk.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [AsyncPipe, DatePipe, HeaderComponent, IonContent, IonItem, IonLabel, IonList, IonSpinner],
})
export class ScanRiskDetailPage {
	private readonly service = inject(ScanRiskService);
	private readonly route = inject(ActivatedRoute);
	private readonly programYear = inject(PROGRAM_YEAR);

	public readonly state$ = this.route.paramMap.pipe(
		map((params) => params.get('uid') ?? ''),
		switchMap((uid) =>
			combineLatest([
				this.service.checkIn(uid),
				this.service.attempts(this.programYear, uid),
			]).pipe(
				map(([checkIn, attempts]) => ({ status: 'ready' as const, checkIn, attempts })),
				startWith({ status: 'loading' as const }),
				catchError(() => of({ status: 'error' as const })),
			),
		),
	);
}
