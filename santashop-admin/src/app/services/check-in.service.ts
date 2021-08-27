import { Injectable } from '@angular/core';
import { QueryFn } from '@angular/fire/compat/firestore';
import { BehaviorSubject } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  pluck,
  publishReplay,
  refCount,
  switchMap,
  take
} from 'rxjs/operators';
import {
  FireCRUDStateless,
  ICheckIn,
  ICheckInStats,
  IRegistration,
} from 'santashop-core/src';
import { CheckInHelpers } from '../helpers/checkin-helpers';
import firebase from 'firebase/compat/app';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root',
})
export class CheckInService {
  private readonly REGISTRATION_COLLECTION = 'registrations';
  private readonly CHECKIN_COLLECTION = 'checkins';

  private readonly _$qrCode = new BehaviorSubject<IRegistration>(undefined);
  public readonly $qrCode = this._$qrCode.pipe(filter((value) => !!value));

  private readonly _$registrationCodeFromScan = this.$qrCode.pipe(pluck('id'));
  private readonly _$registrationCodeFromSearch = new BehaviorSubject<string>(undefined);
  public readonly $registrationCodeFromSearch = this._$registrationCodeFromSearch.pipe(filter((value) => !!value));

  private readonly _$manualRegistrationEdit = new BehaviorSubject<IRegistration>(undefined);
  public readonly $manualRegistrationEdit = this._$manualRegistrationEdit.asObservable();

  public readonly registrationFromScanSubscription = this._$registrationCodeFromScan.subscribe(value => {
    this._$registrationCode.next(value);
  });

  public readonly registrationFromSearchSubscription = this.$registrationCodeFromSearch.subscribe(value => {
    this._$registrationCode.next(value);
  });

  private readonly _$registrationCode = new BehaviorSubject<string>(undefined);
  public readonly $registrationCode = this._$registrationCode.pipe(
    filter((value) => !!value),
    distinctUntilChanged((prev, curr) => prev === curr),
    publishReplay(1),
    refCount()
  );

  public readonly $registration = this.$registrationCode.pipe(
    distinctUntilChanged((prev, curr) => prev === curr),
    filter((id) => !!id),
    switchMap((id) => this.lookupRegistration(id)),
    map(response => {
      response.children = CheckInHelpers.sortChildren(response.children);
      return response;
    })
  );

  public readonly $checkinRecord = this.$registration.pipe(
    distinctUntilChanged((prev, curr) => prev?.id === curr.id),
    pluck('id'),
    switchMap((customerId) => this.lookupCheckIn(customerId))
  );

  private readonly storeCheckIn = (checkIn: ICheckIn) =>
    this.httpService
      .save<ICheckIn>(
        this.CHECKIN_COLLECTION,
        checkIn.customerId,
        checkIn,
        true
      )
      .pipe(take(1));

  constructor(
    private readonly httpService: FireCRUDStateless,
    private readonly alertController: AlertController
  ) {}

  public reset() {
    this._$qrCode.next(undefined);
    this._$manualRegistrationEdit.next(undefined);
    this._$registrationCodeFromSearch.next(undefined);
  }

  public setRegistrationToEdit(registration: IRegistration) {
    this._$manualRegistrationEdit.next(registration);
  }

  public setQrCode(code: string): void {
    const registration: IRegistration = JSON.parse(code);
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
      .readMany<IRegistration>(this.REGISTRATION_COLLECTION, query, 'id')
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

  public async saveCheckIn(registration?: IRegistration, isEdit = false) {
    if (!registration) {
      registration = await this.$registration.pipe(take(1)).toPromise();
    }

    const checkin = this.registrationToCheckIn(registration, isEdit);
    await this.storeCheckIn(checkin).toPromise();
  }

  public async checkinCompleteAlert() {
    const alert = await this.alertController.create({
      header: 'Check-In Complete',
      // message: 'Instruct the customer to move forward',
      buttons: [
        {
          text: 'Ok',
        }
      ]
    });

    await alert.present();

    return await alert.onDidDismiss();
  }

  private registrationToCheckIn(registration: IRegistration, isEdit: boolean): ICheckIn {
    const checkin: ICheckIn = {
      customerId: registration.id ?? null,
      registrationCode: registration.code || null,
      checkInDateTime: firebase.firestore.Timestamp.now(),
      inStats: false,
      stats: this.registrationStats(registration, isEdit),
    };

    return checkin;
  }

  private registrationStats(registration: IRegistration, isEdit: boolean): ICheckInStats {
    const stats: ICheckInStats = {
      preregistered: (!!registration.code && !!registration.id) || false,
      children: registration.children?.length || 0,
      ageGroup02: registration.children.filter((c) => c.a === '0').length,
      ageGroup35: registration.children.filter((c) => c.a === '3').length,
      ageGroup68: registration.children.filter((c) => c.a === '6').length,
      ageGroup911: registration.children.filter((c) => c.a === '9').length,
      toyTypeInfant: registration.children.filter((c) => c.t === 'i').length,
      toyTypeBoy: registration.children.filter((c) => c.t === 'b').length,
      toyTypeGirl: registration.children.filter((c) => c.t === 'g').length,
      modifiedAtCheckIn: isEdit,
      zipCode: registration.zipCode,
    };
    return stats;
  }
}
