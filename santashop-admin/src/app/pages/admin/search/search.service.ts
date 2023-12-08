import { Injectable } from '@angular/core';
import { FireRepoLite, QueryConstraint, User } from '@santashop/core';
import { COLLECTION_SCHEMA, RegistrationSearchIndex } from '@santashop/models';
import { limit, orderBy, where } from 'firebase/firestore';
import { BehaviorSubject, Observable, shareReplay } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class SearchService {
	private readonly searchResults = new BehaviorSubject<Observable<
		RegistrationSearchIndex[]
	> | null>(null);
	public readonly searchResults$: Observable<Observable<
		RegistrationSearchIndex[]
	> | null> = this.searchResults.asObservable().pipe(shareReplay(1));

	private readonly index =
		this.repoService.collection<RegistrationSearchIndex>(
			COLLECTION_SCHEMA.registrationSearchIndex,
		);

	private readonly users =
		this.repoService.collection<User>(
			COLLECTION_SCHEMA.users,
		);

	private readonly queryLastNameZip = (
		lastName: string,
		zipCode: string,
	): QueryConstraint[] =>
		[
			where('zip', '==', zipCode),
			where('lastName', '>=', lastName),
			where('lastName', '<=', lastName + '\uf8ff'),
			orderBy('lastName', 'asc'),
			limit(50),
		] as QueryConstraint[];

	private readonly queryEmail = (emailAddress: string): QueryConstraint[] =>
		[
			where('emailAddress', '>=', emailAddress),
			where('emailAddress', '<=', emailAddress + '\uf8ff'),
			orderBy('emailAddress', 'asc'),
			limit(50),
		] as QueryConstraint[];

	private readonly queryCode = (code: string): QueryConstraint[] =>
		[where('code', '==', code), limit(50)] as QueryConstraint[];

	constructor(private readonly repoService: FireRepoLite) {}

	public searchByLastNameZip(lastName: string, zipCode: string): void {
		this.searchResults.next(
			this.index.readMany(
				this.queryLastNameZip(lastName.toLowerCase(), zipCode),
			),
		);
	}

	public searchByEmail(emailAddress: string): void {
		this.searchResults.next(
			this.index.readMany(this.queryEmail(emailAddress.toLowerCase())),
		);
	}

	public searchByCode(code: string): void {
		this.searchResults.next(
			this.index.readMany(this.queryCode(code.toUpperCase())),
		);
	}

	// This method operates differently than the others. It returns a list of users directly
	public searchUsersByEmailAddress(emailAddress: string): Observable<User[]> {
		const queryConstraint = where('emailAddress', '==', emailAddress.toLowerCase());
		return this.users.readMany([queryConstraint]);
	}

	public reset(): void {
		this.searchResults.next(null);
	}
}
