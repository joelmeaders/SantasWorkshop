import { Injectable } from '@angular/core';
import { QueryFn } from '@angular/fire/firestore';
import { race, ReplaySubject } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  pluck,
  publishReplay,
  refCount,
  switchMap,
  take,
} from 'rxjs/operators';
import {
  FireCRUDStateless,
  ICheckIn,
  ICheckInStats,
  Registration,
} from 'santashop-core/src/public-api';
import { CheckInHelpers } from '../helpers/registration-helpers';

@Injectable({
  providedIn: 'root',
})
export class CheckInService {
  private readonly REGISTRATION_COLLECTION = 'registrations';
  private readonly CHECKIN_COLLECTION = 'checkins';

  private readonly _$qrCode = new ReplaySubject<Registration>(1);
  public readonly $qrCode = this._$qrCode.pipe(filter((value) => !!value));

  private readonly _$registrationCodeFromScan = this._$qrCode.pipe(pluck('id'));
  private readonly _$registrationCodeFromSearch = new ReplaySubject<string>(1);

  public readonly $registrationCode = race(
    this._$registrationCodeFromScan,
    this._$registrationCodeFromSearch
  ).pipe(
    distinctUntilChanged((prev, curr) => prev === curr),
    filter((value) => !!value),
    publishReplay(1),
    refCount()
  );

  public readonly $registration = this.$registrationCode.pipe(
    distinctUntilChanged((prev, curr) => prev === curr),
    filter((id) => !!id),
    switchMap((id) => this.lookupRegistration(id)),
    map((registration) => this.hydrateRegistration(registration)),
    publishReplay(1),
    refCount()
  );

  public readonly $checkinRecord = this.$registration.pipe(
    distinctUntilChanged((prev, curr) => prev?.id === curr.id),
    pluck('id'),
    switchMap((customerId) => this.lookupCheckIn(customerId)),
    publishReplay(1),
    refCount()
  );

  public readonly storeCheckIn = (checkIn: ICheckIn) =>
    this.httpService
      .save<ICheckIn>(
        this.CHECKIN_COLLECTION,
        checkIn.customerId,
        checkIn,
        true
      )
      .pipe(take(1));

  constructor(private readonly httpService: FireCRUDStateless) {}

  public reset() {}

  public setQrCode(code: string): void {
    const registration: Registration = JSON.parse(code);
    this._$qrCode.next(registration);
  }

  public setRegistrationCode(code: string): void {
    this._$registrationCodeFromSearch.next(code);
  }

  public resetQrCode(): void {
    this._$qrCode.next(null);
  }

  public lookupRegistration(id: string) {
    const query: QueryFn = (qry) => qry.where('code', '==', id);
    return this.httpService
      .readMany<Registration>(this.REGISTRATION_COLLECTION, query, 'id')
      .pipe(
        take(1),
        map((response) => response[0] ?? undefined)
      );
  }

  public lookupCheckIn(customerId: string) {
    return this.httpService
      .readOne<ICheckIn>(this.CHECKIN_COLLECTION, customerId, 'id')
      .pipe(take(1));
  }

  public hydrateRegistration(registration: Registration) {
    registration.children.forEach((child) => {
      child.a = CheckInHelpers.expandA(child.a);
      child.t = CheckInHelpers.expandT(child.t);
    });
    return registration;
  }

  public async saveCheckIn(registration?: Registration) {
    if (!registration) {
      registration = await this.$registration.pipe(take(1)).toPromise();
    }

    const checkin = this.registrationToCheckIn(registration);
    return await this.storeCheckIn(checkin).toPromise();
  }

  private registrationToCheckIn(registration: Registration): ICheckIn {
    const checkin: ICheckIn = {
      customerId: registration.id,
      registrationCode: registration.code,
      checkInDateTime: new Date(),
      stats: this.registrationStats(registration),
    };

    return checkin;
  }

  private registrationStats(registration: Registration): ICheckInStats {
    const stats: ICheckInStats = {
      preregistered: (!!registration.code && !!registration.id) || false,
      children: registration.children?.length || 0,
      ageGroup02: registration.children.filter((c) => c.a === '0-2').length,
      ageGroup35: registration.children.filter((c) => c.a === '3-5').length,
      ageGroup68: registration.children.filter((c) => c.a === '6-8').length,
      ageGroup911: registration.children.filter((c) => c.a === '9-11').length,
      toyTypeInfant: registration.children.filter((c) => c.t === 'infant')
        .length,
      toyTypeBoy: registration.children.filter((c) => c.t === 'boy').length,
      toyTypeGirl: registration.children.filter((c) => c.t === 'girl').length,
      modifiedAtCheckIn: null, // TODO
      zipCode: registration.zipCode,
    };
    return stats;
  }
}
