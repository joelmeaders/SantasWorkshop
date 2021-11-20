import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  publishReplay,
  refCount,
  switchMap,
  take,
} from 'rxjs/operators';
import { CheckInHelpers } from '../helpers/checkin-helpers';
import { AlertController } from '@ionic/angular';
import { AgeGroup, COLLECTION_SCHEMA, ICheckIn, ICheckInStats, IChild, IRegistration, ToyType } from '@models/*';
import { FireRepoLite } from '@core/*';

@Injectable({
  providedIn: 'root',
})
export class CheckInService {

  private readonly _$registrationCodeFromSearch = 
    new BehaviorSubject<string | undefined>(undefined);
  public readonly $registrationCodeFromSearch =
    this._$registrationCodeFromSearch.pipe(
      filter((value) => !!value),
      map((value) => value as string)
    );

  private readonly _$manualRegistrationEdit = 
    new BehaviorSubject<IRegistration | undefined>(undefined);
  public readonly $manualRegistrationEdit =
    this._$manualRegistrationEdit.asObservable();

  public readonly registrationFromSearchSubscription =
    this.$registrationCodeFromSearch.subscribe((value) => {
      this._$registrationCode.next(value);
    });

  private readonly _$registrationCode = new BehaviorSubject<string | undefined>(
    undefined
  );
  public readonly $registrationCode = this._$registrationCode.pipe(
    filter((value) => !!value),
    distinctUntilChanged((prev, curr) => prev === curr),
    publishReplay(1),
    refCount()
  );

  public readonly $registration = this.$registrationCode.pipe(
    distinctUntilChanged((prev, curr) => prev === curr),
    filter((id) => !!id),
    switchMap((id) => this.lookupRegistrationByQrCode(id!)),
    map((response) => {
      response.children = CheckInHelpers.sortChildren(response.children!) as any[] as IChild[];
      return response;
    })
  );

  public readonly $checkinRecord = this.$registration.pipe(
    distinctUntilChanged((prev, curr) => prev?.uid === curr.uid),
    switchMap((registration) => this.lookupCheckIn(registration.uid!))
  );

  private readonly storeCheckIn = (checkIn: ICheckIn) =>
    this.httpService
      .collection(COLLECTION_SCHEMA.checkins)
      .addById(checkIn.customerId!, checkIn)
      .pipe(take(1));

  constructor(
    private readonly httpService: FireRepoLite,
    private readonly alertController: AlertController
  ) {}

  public reset() {
    this._$manualRegistrationEdit.next(undefined);
    this._$registrationCodeFromSearch.next(undefined);
  }

  public setRegistrationToEdit(registration: IRegistration) {
    this._$manualRegistrationEdit.next(registration);
  }

  public setRegistrationCode(code: string): void {
    this._$registrationCodeFromSearch.next(code);
  }

  public lookupRegistrationByQrCode(qrcode: string) {
    console.log(qrcode)
    return this.httpService
      .collection(COLLECTION_SCHEMA.registrations)
      .readMany<IRegistration>((qry) => qry.where('qrcode', '==', qrcode))
      .pipe(
        take(1),
        map((response) => response[0] ?? undefined)
      );
  }

  public lookupCheckIn(customerId: string) {
    console.log('lookupCheckIn', customerId)
    return this.httpService
      .collection(COLLECTION_SCHEMA.registrations)
      .read<ICheckIn>(customerId, 'customerId')
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
        },
      ],
    });

    await alert.present();

    return alert.onDidDismiss();
  }

  private registrationToCheckIn(
    registration: IRegistration,
    isEdit: boolean
  ): ICheckIn {
    const checkin: ICheckIn = {
      customerId: registration.uid!,
      registrationCode: registration.qrcode!,
      checkInDateTime: new Date(),
      inStats: false,
      stats: this.registrationStats(registration, isEdit),
    };

    return checkin;
  }

  private registrationStats(
    registration: IRegistration,
    isEdit: boolean
  ): ICheckInStats {
    const stats: ICheckInStats = {
      preregistered: (!!registration.qrcode && !!registration.uid) || false,
      children: registration.children?.length || 0,
      ageGroup02: registration.children!.filter((c) => c.ageGroup === AgeGroup.age02).length,
      ageGroup35: registration.children!.filter((c) => c.ageGroup === AgeGroup.age35).length,
      ageGroup68: registration.children!.filter((c) => c.ageGroup === AgeGroup.age68).length,
      ageGroup911: registration.children!.filter((c) => c.ageGroup === AgeGroup.age911).length,
      toyTypeInfant: registration.children!.filter((c) => c.toyType === ToyType.infant).length,
      toyTypeBoy: registration.children!.filter((c) => c.toyType === ToyType.boy).length,
      toyTypeGirl: registration.children!.filter((c) => c.toyType === ToyType.girl).length,
      modifiedAtCheckIn: isEdit,
      zipCode: registration.zipCode!,
    };
    return stats;
  }
}
