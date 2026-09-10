import { AdminReadRepository } from '../../../shared/services/admin-read-repository.service';
import { Injectable, inject } from '@angular/core';
import {
	limit,
	orderBy,
	type QueryConstraint,
	where,
} from 'firebase/firestore/lite';
import {
	COLLECTION_SCHEMA,
	type RegistrationSearchIndex,
	type User,
} from '@santashop/models';
import {
	BehaviorSubject,
	catchError,
	defer,
	map,
	type Observable,
	of,
	shareReplay,
	startWith,
	switchMap,
	timeout,
} from 'rxjs';

export type SearchState =
	| { status: 'idle' | 'loading' | 'error' }
	| { status: 'ready'; results: RegistrationSearchIndex[] };

@Injectable({ providedIn: 'root' })
export class SearchService {
	private readonly repo = inject(AdminReadRepository);
	private readonly criteria = new BehaviorSubject<QueryConstraint[] | null>(
		null,
	);
	private readonly index = this.repo.collection<RegistrationSearchIndex>(
		COLLECTION_SCHEMA.registrationSearchIndex,
	);
	private readonly users = this.repo.collection<User>(
		COLLECTION_SCHEMA.users,
	);

	/** One server read per query or refresh, shared by all current consumers. */
	public readonly state$: Observable<SearchState> = this.criteria.pipe(
		switchMap((criteria) =>
			criteria === null
				? of<SearchState>({ status: 'idle' })
				: defer(() => this.index.readMany(criteria)).pipe(
						timeout({ first: 5000 }),
						map((results): SearchState => ({
							status: 'ready',
							results,
						})),
						catchError(() => of<SearchState>({ status: 'error' })),
						startWith<SearchState>({ status: 'loading' }),
					),
		),
		shareReplay({ bufferSize: 1, refCount: true }),
	);

	public searchByLastNameZip(lastName: string, zipCode: string): void {
		const name = lastName.toLowerCase();
		this.criteria.next([
			where('zip', '==', zipCode),
			where('lastName', '>=', name),
			where('lastName', '<=', name + '\uf8ff'),
			orderBy('lastName', 'asc'),
			limit(50),
		]);
	}

	public searchByEmail(emailAddress: string): void {
		const email = emailAddress.toLowerCase();
		this.criteria.next([
			where('emailAddress', '>=', email),
			where('emailAddress', '<=', email + '\uf8ff'),
			orderBy('emailAddress', 'asc'),
			limit(50),
		]);
	}

	public searchByCode(code: string): void {
		this.criteria.next([
			where('code', '==', code.toUpperCase()),
			limit(50),
		]);
	}

	public searchUsersByEmailAddress(emailAddress: string): Observable<User[]> {
		return this.users.readMany([
			where('emailAddress', '==', emailAddress.toLowerCase()),
		]);
	}

	public refresh(): void {
		this.criteria.next(this.criteria.value);
	}
	public reset(): void {
		this.criteria.next(null);
	}
}
