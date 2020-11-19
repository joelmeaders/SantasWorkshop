import { Injectable } from '@angular/core';
import { Query } from '@angular/fire/firestore';
import { BehaviorSubject, Subject } from 'rxjs';
import { filter, map, shareReplay, switchMap, take } from 'rxjs/operators';
import { FireCRUDStateless, Registration } from 'santashop-core/src/public-api';
import { RegistrationSearch } from '../models/registration-search.model';

@Injectable({
  providedIn: 'root'
})
export class RegistrationSearchService {

  private readonly REGISTRATION_COLLECTION = 'registrations';

  private readonly _$searchState = new BehaviorSubject<RegistrationSearch>(undefined);
  public readonly $searchState = this._$searchState.pipe(
    shareReplay(1)
  );

  private readonly _$searchStateValid = new Subject<boolean>();
  public readonly $searchStateValid = this._$searchStateValid.pipe(
    shareReplay(1)
  );

  public readonly $searchResults = this._$searchStateValid.pipe(
    filter(isValid => !!isValid),
    switchMap(() => this.$searchState),
    // Make query
    // run query
    shareReplay(1)
  );

  constructor(
    private readonly httpService: FireCRUDStateless
  ) { }

  public queryByCode(id: string) {
    const query: Query = this.httpService.collectionRef(this.REGISTRATION_COLLECTION).where('code', '==', id);
    return this.httpService.readMany<Registration>(this.REGISTRATION_COLLECTION, query, 'id')
      .pipe(take(1),map(response => response[0] ?? undefined));
  }

  public queryByName(id: string) {
    const query: Query = this.httpService.collectionRef(this.REGISTRATION_COLLECTION).where('code', '==', id);
    return this.httpService.readMany<Registration>(this.REGISTRATION_COLLECTION, query, 'id')
      .pipe(take(1),map(response => response[0] ?? undefined));
  }

  public setSearchState(search: RegistrationSearch) {

    this._$searchState.next(search);
    const isValid = this.isSearchStateValid(search);
    this._$searchStateValid.next(isValid);
  }

  private isSearchStateValid(search: RegistrationSearch): boolean {

    if (!search) {
      this._$searchStateValid.next(false);
    }

    const hasNames = search.firstName?.length > 1 && search.lastName?.length > 1;
    const hasCode = !!search.registrationCode && search.registrationCode.length === 8;

    return hasNames || hasCode;
  }

  public resetSearchState() {
    this._$searchState.next(undefined);
    this._$searchStateValid.next(undefined);
  }
}
