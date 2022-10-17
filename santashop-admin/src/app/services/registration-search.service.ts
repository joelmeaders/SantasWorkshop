import { Injectable } from '@angular/core';
import { RegistrationSearchIndex } from '../../../../santashop-models/src/public-api';
import { BehaviorSubject } from 'rxjs';
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

	private readonly _$searchState = new BehaviorSubject<
		IRegistrationSearch | undefined
	>(undefined);
	public readonly $searchState = this._$searchState.pipe(
		publishReplay(1),
		refCount()
	);

	private readonly _$searchStateValid = new BehaviorSubject<boolean>(false);
	public readonly $searchStateValid = this._$searchStateValid.pipe(
		publishReplay(1),
		refCount()
	);

	private readonly _$searchResults = new BehaviorSubject<
		RegistrationSearchIndex[] | undefined
	>(undefined);
	public readonly $searchResults = this._$searchResults.pipe(
		publishReplay(1),
		refCount()
	);

	private readonly getSearchResults = () =>
		this.$searchStateValid.pipe(
			filter((isValid) => isValid === true),
			switchMap(() => this.$searchState),
			filter((state) => this.isSearchStateValid(state)),
			switchMap((state) =>
				!!state?.registrationCode
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

	private orderResultsByName(results: RegistrationSearchIndex[]) {
		if (!results?.length) {
			return results;
		}
		return chain(results).sortBy('lastName').sortBy('firstName').value();
	}

	public async search(): Promise<void> {
		const results = await this.getSearchResults().pipe(take(1)).toPromise();
		this._$searchResults.next(results);
	}

	public setSearchState(search: IRegistrationSearch) {
		this._$searchState.next(search);
		const isValid = this.isSearchStateValid(search);

		if (isValid) {
			this.formatSearchStrings(search);
		}

		this._$searchStateValid.next(isValid);
	}

	private formatSearchStrings(search: IRegistrationSearch) {
		if (!!search.registrationCode) {
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
		if (search == undefined) {
			return false;
		}

		const hasNames =
			(search?.firstName?.length ?? 0) > 1 &&
			(search?.lastName?.length ?? 0) > 1;
		const hasCode =
			!!search.registrationCode && search.registrationCode.length === 8;

		return hasNames || hasCode;
	}

	public resetSearchState() {
		this._$searchStateValid.next(false);
		this._$searchState.next(undefined);
		this._$searchResults.next(undefined);
	}
}
