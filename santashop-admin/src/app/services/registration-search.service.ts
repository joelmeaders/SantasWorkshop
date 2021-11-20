import { Injectable } from '@angular/core';
import { QueryFn } from '@angular/fire/compat/firestore';
import { RegistrationSearchIndex } from '@models/*';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, map, publishReplay, refCount, switchMap, take } from 'rxjs/operators';
import { chain } from 'underscore';
import { RegistrationSearch } from '../models/registration-search.model';

@Injectable({
  providedIn: 'root'
})
export class RegistrationSearchService {

  private readonly INDEX_COLLECTION = 'registrationsearchindex';

  private readonly _$searchState = new BehaviorSubject<RegistrationSearch | undefined>(undefined);
  public readonly $searchState = this._$searchState.pipe(
    publishReplay(1),
    refCount()
  );

  private readonly _$searchStateValid = new BehaviorSubject<boolean>(false);
  public readonly $searchStateValid = this._$searchStateValid.pipe(
    publishReplay(1),
    refCount()
  );

  private readonly _$searchResults = new BehaviorSubject<RegistrationSearchIndex[] | undefined>(undefined);
  public readonly $searchResults = this._$searchResults.pipe(
    publishReplay(1),
    refCount()
  );

  private readonly getSearchResults = () => this.$searchStateValid.pipe(
    filter(isValid => isValid === true),
    switchMap(() => this.$searchState),
    filter(state => this.isSearchStateValid(state)),
    switchMap(state => !!state.registrationCode
      ? this.queryByCode(state.registrationCode)
      : this.queryByName(state.firstName, state.lastName)
    )
  )

  constructor(
    private readonly httpService: FireCRUDStateless
  ) { }

  public queryByCode(id: string): Observable<RegistrationSearchIndex[]> {
    const query: QueryFn = qry => qry
      .where('code', '==', id)
      .orderBy('lastName', 'asc')
      .orderBy('firstName', 'asc');
    return this.httpService.readMany<RegistrationSearchIndex>(this.INDEX_COLLECTION, query, 'customerId')
      .pipe(take(1));
  }

  public queryByName(firstName: string, lastName: string): Observable<RegistrationSearchIndex[]> {
    const query: QueryFn = qry => qry
      .where('firstName', '==', firstName)
      .where('lastName', '>=', lastName).where('lastName', '<=', lastName + '\uf8ff')
      .limit(50);
    return this.httpService.readMany<RegistrationSearchIndex>(this.INDEX_COLLECTION, query, 'customerId')
      .pipe(take(1),map(results => this.orderNameResults(results)));
  }

  private orderNameResults(results: RegistrationSearchIndex[]) {
    if (!results?.length) {
      return results;
    }
    return chain(results).sortBy('lastName').sortBy('firstName').value();
  }

  public async search(): Promise<void> {
    const results = await this.getSearchResults().pipe(take(1)).toPromise();
    this._$searchResults.next(results);
  }

  public setSearchState(search: RegistrationSearch) {
    this._$searchState.next(search);
    const isValid = this.isSearchStateValid(search);

    if (isValid) {
      this.formatSearchStrings(search);
    }

    this._$searchStateValid.next(isValid);
  }

  private formatSearchStrings(search: RegistrationSearch) {
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

  private isSearchStateValid(search: RegistrationSearch): boolean {

    if (search == undefined) {
      return false;
    }

    const hasNames = search.firstName?.length > 1 && search.lastName?.length > 1;
    const hasCode = !!search.registrationCode && search.registrationCode.length === 8;

    return hasNames || hasCode;
  }

  public resetSearchState() {
    this._$searchStateValid.next(false);
    this._$searchState.next(undefined);
    this._$searchResults.next(undefined);
  }
}
