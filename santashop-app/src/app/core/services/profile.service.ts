import { Injectable } from '@angular/core';
import {
	distinctUntilChanged,
	map,
	Observable,
	shareReplay,
	switchMap,
} from 'rxjs';
import { AuthService, filterNil, FireRepoLite } from '@santashop/core';
import { COLLECTION_SCHEMA, User } from '@santashop/models';

@Injectable({
	providedIn: 'root',
})
export class ProfileService {
	public readonly userProfile$ = this.authService.uid$.pipe(
		switchMap((id) => this.getUser$(id)),
	);

	public readonly referredBy$ = this.userProfile$.pipe(
		distinctUntilChanged(),
		map((data) => data.referredBy),
		shareReplay(1),
	);

	private readonly getUser$ = (uuid: string): Observable<User> =>
		this.httpService
			.collection<User>(COLLECTION_SCHEMA.users)
			.read(uuid)
			.pipe(filterNil());

	constructor(
		private readonly authService: AuthService,
		private readonly httpService: FireRepoLite,
	) {}
}
