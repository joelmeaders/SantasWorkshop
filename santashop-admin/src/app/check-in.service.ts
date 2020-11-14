import { Injectable } from '@angular/core';
import { Query } from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { Registration } from '@app/core/models/registration.model';
import { FireCRUDStateless } from '@app/core/services/http/base';
import { RegistrationHelpers } from '@app/shared/registration-helpers';
import { BehaviorSubject } from 'rxjs';
import { filter, map, pluck, publishReplay, refCount, switchMap, take, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CheckInService {

  private readonly REGISTRATION_COLLECTION = 'registrations';

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

  constructor(
    private readonly httpService: FireCRUDStateless,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) { }

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
    registration.children.forEach(child => {
      child.a = RegistrationHelpers.expandA(child.a);
      child.t = RegistrationHelpers.expandT(child.t);
    });
    return registration;
  }
}
