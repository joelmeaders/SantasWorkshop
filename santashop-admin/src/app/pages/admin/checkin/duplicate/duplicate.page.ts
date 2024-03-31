import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FireRepoLite, filterNil, timestampToDate } from '@santashop/core';
import { map, switchMap } from 'rxjs';
import { COLLECTION_SCHEMA } from '@santashop/models';

@Component({
	selector: 'admin-duplicate',
	templateUrl: './duplicate.page.html',
	styleUrls: ['./duplicate.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuplicatePage {
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

	constructor(
		private readonly httpService: FireRepoLite,
		private readonly route: ActivatedRoute,
	) {}
}
