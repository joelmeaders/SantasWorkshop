import { Injectable } from '@angular/core';
import {
	distinctUntilChanged,
	map,
	Observable,
	shareReplay,
	switchMap,
} from 'rxjs';
import { AuthService, FireRepoLite } from '@core/*';
import { COLLECTION_SCHEMA, User } from '@models/*';

@Injectable({
	providedIn: 'root',
})
export class ProfileService {
	private readonly getUser$ = (uuid: string): Observable<User> =>
		this.httpService.collection<User>(COLLECTION_SCHEMA.users).read(uuid);

	public readonly userProfile$ = this.authService.uid$.pipe(
		switchMap((id) => this.getUser$(id))
	);

	public readonly referredBy$ = this.userProfile$.pipe(
		distinctUntilChanged(),
		map((data) => data.referredBy),
		shareReplay(1)
	);

	constructor(
		private readonly authService: AuthService,
		private readonly httpService: FireRepoLite
	) {}
}
