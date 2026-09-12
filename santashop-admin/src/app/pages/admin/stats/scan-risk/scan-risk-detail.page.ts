import { AdminDatePipe } from '../../../../shared/preferences/admin-date.pipe';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { PROGRAM_YEAR } from '@santashop/core/admin/firestore';
import {
	IonButton,
	IonContent,
	IonItem,
	IonLabel,
	IonList,
	IonSpinner,
} from '@ionic/angular/standalone';
import {
	BehaviorSubject,
	catchError,
	combineLatest,
	map,
	of,
	startWith,
	switchMap,
} from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { ScanRiskService } from '../../../../shared/services/scan-risk.service';

@Component({
	selector: 'admin-scan-risk-detail',
	templateUrl: './scan-risk-detail.page.html',
	styleUrls: ['./scan-risk.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AdminTextPipe,
		AdminDatePipe,
		HeaderComponent,
		IonButton,
		IonContent,
		IonItem,
		IonLabel,
		IonList,
		IonSpinner,
	],
})
export class ScanRiskDetailPage {
	private readonly service = inject(ScanRiskService);
	private readonly route = inject(ActivatedRoute);
	private readonly programYear = inject(PROGRAM_YEAR);

	private readonly refreshTrigger = new BehaviorSubject<void>(undefined);
	private readonly state$ = combineLatest([
		this.route.paramMap,
		this.refreshTrigger,
	]).pipe(
		map(([params]) => params.get('uid') ?? ''),
		switchMap((uid) =>
			combineLatest([
				this.service.checkIn(uid),
				this.service.attempts(this.programYear, uid),
			]).pipe(
				map(([checkIn, attempts]) => ({
					status: 'ready' as const,
					checkIn,
					attempts,
				})),
				startWith({ status: 'loading' as const }),
				catchError(() => of({ status: 'error' as const })),
			),
		),
	);
	public readonly state = toSignal(this.state$, {
		initialValue: {
			status: 'loading' as const,
		},
	});

	public refresh(): void {
		this.refreshTrigger.next();
	}

	public ionViewWillEnter(): void {
		this.refresh();
	}
}
