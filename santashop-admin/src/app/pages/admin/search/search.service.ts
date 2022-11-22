import { Injectable } from '@angular/core';
import { FireRepoLite, QueryConstraint } from '@core/*';
import { COLLECTION_SCHEMA, RegistrationSearchIndex } from '@models/*';
import { limit, orderBy, where } from 'firebase/firestore';
import { map, Observable } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class SearchService {
	private readonly index =
		this.repoService.collection<RegistrationSearchIndex>(
			COLLECTION_SCHEMA.registrationSearchIndex
		);

	private readonly constaintLastNameZip = (
		lastName: string,
		zipCode: string
	): QueryConstraint[] =>
		[
			where('zip', '==', zipCode),
			where('lastName', '>=', lastName),
			where('lastName', '<=', lastName + '\uf8ff'),
			orderBy('lastName', 'asc'),
			limit(50),
		] as QueryConstraint[];

	private readonly sort = (
		a: RegistrationSearchIndex,
		b: RegistrationSearchIndex
	): number =>
		a.lastName.localeCompare(b.lastName) ||
		a.firstName.localeCompare(b.firstName) ||
		a.zip.localeCompare(b.zip);

	private readonly sortResults = (
		results: RegistrationSearchIndex[]
	): RegistrationSearchIndex[] => results.sort(this.sort);

	public readonly searchByLastNameZip = (
		lastName: string,
		zipCode: string
	): Observable<RegistrationSearchIndex[]> =>
		this.index
			.readMany(
				this.constaintLastNameZip(lastName.toLowerCase(), zipCode)
			)
			.pipe(map(this.sortResults));

	constructor(private readonly repoService: FireRepoLite) {}
}
