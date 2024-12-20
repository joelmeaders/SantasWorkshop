import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
	AnalyticsWrapper,
	FireRepoLite,
	filterNil,
	timestampToDate,
} from '@santashop/core';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { COLLECTION_SCHEMA } from '@santashop/models';
import { HeaderComponent } from '../../../../shared/components/header/header.component';

import { AsyncPipe, DatePipe, KeyValuePipe } from '@angular/common';
import { IonContent, IonNote } from '@ionic/angular/standalone';

@Component({
	selector: 'admin-duplicate',
	templateUrl: './duplicate.page.html',
	styleUrls: ['./duplicate.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		HeaderComponent,
		AsyncPipe,
		DatePipe,
		KeyValuePipe,
		IonContent,
		IonNote,
	],
})
export class DuplicatePage {
	private readonly httpService = inject(FireRepoLite);
	private readonly route = inject(ActivatedRoute);
	private readonly analytics = inject(AnalyticsWrapper);

	private readonly uid$ = this.route.params.pipe(
		map((params) => params.uid as string),
	);

	public readonly checkin$ = this.uid$.pipe(
		switchMap((uid) =>
			this.httpService
				.collection(COLLECTION_SCHEMA.checkins)
				.read(uid, 'customerId'),
		),
		filterNil(),
		map((data) => {
			data.checkInDateTime = timestampToDate(data.checkInDateTime);
			return data;
		}),
	);

	protected readonly logSubscription = this.uid$
		.pipe(
			takeUntilDestroyed(),
			tap((uid) => {
				this.analytics.logEventWithParams('admin_checkin_duplicate', {
					uid,
					fatal: true,
				});
			}),
			catchError(() => of()),
		)
		.subscribe();
}
