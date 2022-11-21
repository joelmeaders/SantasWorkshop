import { Injectable } from '@angular/core';
import { RegistrationSearchIndex } from '../../../../santashop-models/src/public-api';
import { BehaviorSubject, Observable } from 'rxjs';
import {
	filter,
	map,
	publishReplay,
	refCount,
	switchMap,
	take,
} from 'rxjs/operators';
import { chain } from 'underscore';
import { IRegistrationSearch } from '../models/registration-search.model';
import { LookupService } from './lookup.service';

@Injectable({
	providedIn: 'root',
})
export class RegistrationSearchService {
	// Passthrough function
	public readonly getRegistrationByUid$ =
		this.lookupService.getRegistrationByUid$;

	private readonly searchState = new BehaviorSubject<
		IRegistrationSearch | undefined
	>(undefined);
	public readonly $searchState = this.searchState.pipe(
		publishReplay(1),
		refCount()
	);

	private readonly searchStateValid = new BehaviorSubject<boolean>(false);
	public readonly $searchStateValid = this.searchStateValid.pipe(
		publishReplay(1),
		refCount()
	);

	private readonly searchResults = new BehaviorSubject<
		RegistrationSearchIndex[] | undefined
	>(undefined);
	public readonly $searchResults = this.searchResults.pipe(
		publishReplay(1),
		refCount()
	);

	private readonly getSearchResults = (): Observable<
		RegistrationSearchIndex[]
	> =>
		this.$searchStateValid.pipe(
			filter((isValid) => isValid === true),
			switchMap(() => this.$searchState),
			filter((state) => this.isSearchStateValid(state)),
			switchMap((state) =>
				state?.registrationCode
					? this.lookupService.searchIndexByQrCode$(
							state.registrationCode
					  )
					: this.lookupService.searchIndexByName$(
							state?.firstName!,
							state?.lastName!
					  )
			),
			map((results) => this.orderResultsByName(results))
		);

	constructor(private readonly lookupService: LookupService) {}

	private orderResultsByName(
		results: RegistrationSearchIndex[]
	): RegistrationSearchIndex[] {
		if (!results?.length) {
			return results;
		}
		return chain(results).sortBy('lastName').sortBy('firstName').value();
	}

	public async search(): Promise<void> {
		const results = await this.getSearchResults().pipe(take(1)).toPromise();
		this.searchResults.next(results);
	}

	public setSearchState(search: IRegistrationSearch): void {
		this.searchState.next(search);
		const isValid = this.isSearchStateValid(search);

		if (isValid) {
			this.formatSearchStrings(search);
		}

		this.searchStateValid.next(isValid);
	}

	private formatSearchStrings(search: IRegistrationSearch): void {
		if (search.registrationCode) {
			search.registrationCode = search.registrationCode.toUpperCase();
		}

		if (search.firstName?.length) {
			search.firstName = search.firstName.toLowerCase();
		}

		if (search.lastName?.length) {
			search.lastName = search.lastName.toLowerCase();
		}
	}

	private isSearchStateValid(search?: IRegistrationSearch): boolean {
		if (!search) {
			return false;
		}

		const hasNames =
			(search?.firstName?.length ?? 0) > 1 &&
			(search?.lastName?.length ?? 0) > 1;
		const hasCode =
			!!search.registrationCode && search.registrationCode.length === 8;

		return hasNames || hasCode;
	}

	public resetSearchState(): void {
		this.searchStateValid.next(false);
		this.searchState.next(undefined);
		this.searchResults.next(undefined);
	}
}
