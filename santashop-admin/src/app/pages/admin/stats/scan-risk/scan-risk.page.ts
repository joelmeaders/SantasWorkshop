import { AdminDatePipe } from '../../../../shared/preferences/admin-date.pipe';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';

import {
	ChangeDetectionStrategy,
	Component,
	inject,
	signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { PROGRAM_YEAR } from '@santashop/core/admin/firestore';
import {
	IonBadge,
	IonButton,
	IonContent,
	IonItem,
	IonLabel,
	IonList,
	IonSpinner,
} from '@ionic/angular/standalone';
import { RouterLink } from '@angular/router';
import {
	BehaviorSubject,
	catchError,
	map,
	of,
	startWith,
	switchMap,
} from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { ScanRiskService } from '../../../../shared/services/scan-risk.service';

@Component({
	selector: 'admin-scan-risk',
	templateUrl: './scan-risk.page.html',
	styleUrls: ['./scan-risk.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AdminTextPipe,
		AdminDatePipe,
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
	private readonly pageSize = signal(20);
	private readonly refreshTrigger = new BehaviorSubject<void>(undefined);

	private readonly state$ = this.refreshTrigger.pipe(
		switchMap(() => {
			const pageSize = this.pageSize();
			return this.service.summaries(this.programYear, pageSize + 1).pipe(
				map((summaries) => ({
					status: 'ready' as const,
					summaries: summaries.slice(0, pageSize),
					hasMore: summaries.length > pageSize,
				})),
				startWith({ status: 'loading' as const }),
				catchError(() => of({ status: 'error' as const })),
			);
		}),
	);
	public readonly state = toSignal(this.state$, {
		initialValue: { status: 'loading' as const },
	});

	public loadMore(): void {
		this.pageSize.update((size) => size + 20);
		this.refreshTrigger.next();
	}

	public refresh(): void {
		this.refreshTrigger.next();
	}

	public ionViewWillEnter(): void {
		this.refresh();
	}
}
