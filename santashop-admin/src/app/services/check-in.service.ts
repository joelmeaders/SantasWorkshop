import { Injectable } from '@angular/core';
import { Query } from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter, map, pluck, publishReplay, refCount, switchMap, take } from 'rxjs/operators';
import { FireCRUDStateless, ICheckIn, ICheckInChildren, ICheckInStats, IChildrenInfo, Registration } from 'santashop-core/src/public-api';
import { CheckInHelpers } from '../helpers/registration-helpers';

@Injectable({
  providedIn: 'root'
})
export class CheckInService {

  private readonly REGISTRATION_COLLECTION = 'registrations';
  private readonly CHECKIN_COLLECTION = 'checkins';

  private readonly _$qrCode = new BehaviorSubject<Registration>(null);
  public readonly $qrCode = this._$qrCode.pipe(
    publishReplay(1),
    refCount()
  );

  public readonly $registrationCode = this._$qrCode.pipe(
    pluck('id'),
    publishReplay(1),
    refCount()
  );

  // public readonly $customerId = this._$qrCode.pipe(
  //   pluck('id'),
  //   publishReplay(1),
  //   refCount()
  // );

  public readonly $children = this._$qrCode.pipe(
    pluck('children'),
    publishReplay(1),
    refCount()
  );

  public readonly $registration = this.$registrationCode.pipe(
    filter(id => !!id),
    switchMap(id => this.lookupRegistration(id)),
    map(registration => this.hydrateRegistration(registration)),
    publishReplay(1),
    refCount()
  );

  public readonly storeCheckIn = (checkIn: ICheckIn) =>
    this.httpService.add<ICheckIn>(this.CHECKIN_COLLECTION, checkIn)
      .pipe(take(1));

  constructor(
    private readonly httpService: FireCRUDStateless,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    console.log('started checkin')
  }

  public reset() {

  }

  public setQrCode(code: string): void {
    const registration: Registration = JSON.parse(code);
    this._$qrCode.next(registration);
    // this.router.navigate(['/admin/check-in', registration.id]);
  }

  public resetQrCode(): void {
    this._$qrCode.next(null);
  }

  public lookupRegistration(id: string) {
    const query: Query = this.httpService.collectionRef(this.REGISTRATION_COLLECTION).where('code', '==', id);
    return this.httpService.readMany<Registration>(this.REGISTRATION_COLLECTION, query, 'id')
      .pipe(take(1),map(response => response[0] ?? undefined));
  }

  public hydrateRegistration(registration: Registration) {
    console.log(registration)
    registration.children.forEach(child => {
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
      customerId: registration.id ?? undefined,
      registrationCode: registration.code ?? undefined,
      checkInDateTime: new Date(),
      children: this.registrationChildren(registration.children),
      stats: this.registrationStats(registration)
    };

    return checkin;
  }

  private registrationChildren(children: IChildrenInfo[]): ICheckInChildren[] {
    const registrationChildren: ICheckInChildren[] = [];

    children.forEach(child => {
      const childToAdd: ICheckInChildren = {
        toyType: child.t,
        ageGroup: child.a
      };
      registrationChildren.push(childToAdd);
    });

    return registrationChildren;
  }

  private registrationStats(registration: Registration): ICheckInStats {
    const stats: ICheckInStats = {
      preregistered: (!!registration.code && !!registration.id) || false,
      children: registration.children?.length || 0,
      ageGroup02: registration.children.filter(c => c.a === '0-2').length,
      ageGroup35: registration.children.filter(c => c.a === '3-5').length,
      ageGroup68: registration.children.filter(c => c.a === '6-8').length,
      ageGroup911: registration.children.filter(c => c.a === '9-11').length,
      toyTypeInfant: registration.children.filter(c => c.t === 'infant').length,
      toyTypeBoy: registration.children.filter(c => c.t === 'boy').length,
      toyTypeGirl: registration.children.filter(c => c.t === 'girl').length,
      modifiedAtCheckIn: null, // TODO
      zipCode: null // TODO
    }
    return stats;
  }
}
