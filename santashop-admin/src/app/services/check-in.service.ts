import { Injectable } from '@angular/core';
import { take } from 'rxjs/operators';
import { AlertController } from '@ionic/angular';
import {
  AgeGroup,
  COLLECTION_SCHEMA,
  ICheckIn,
  ICheckInStats,
  IRegistration,
  ToyType,
} from '@models/*';
import { FireRepoLite } from '@core/*';

@Injectable({
  providedIn: 'root',
})
export class CheckInService {
  // private readonly _$uidFromSearch =
  //   new BehaviorSubject<string | undefined>(undefined);
  // public readonly $uidFromSearch =
  //   this._$uidFromSearch.pipe(
  //     filter((value) => !!value),
  //     map((value) => value as string)
  //   );

  // private readonly _$manualRegistrationEdit =
  //   new BehaviorSubject<IRegistration | undefined>(undefined);
  // public readonly $manualRegistrationEdit =
  //   this._$manualRegistrationEdit.asObservable();

  // public readonly registrationFromSearchSubscription =
  //   this.$uidFromSearch.subscribe((value) => {
  //     this._$registrationCode.next(value);
  //   });

  // private readonly _$registrationCode = new BehaviorSubject<string | undefined>(
  //   undefined
  // );
  // public readonly $registrationCode = this._$registrationCode.pipe(
  //   filter((value) => !!value),
  //   distinctUntilChanged((prev, curr) => prev === curr),
  //   publishReplay(1),
  //   refCount()
  // );

  // public readonly $registration = this.$registrationCode.pipe(
  //   distinctUntilChanged((prev, curr) => prev === curr),
  //   filter((id) => !!id),
  //   switchMap((id) => this.lookupRegistrationByQrCode(id!)),
  //   map((response) => {
  //     response.children = CheckInHelpers.sortChildren(response.children!) as any[] as IChild[];
  //     return response;
  //   })
  // );

  // public readonly $checkinRecord = this.$registration.pipe(
  //   distinctUntilChanged((prev, curr) => prev?.uid === curr.uid),
  //   switchMap((registration) => this.lookupCheckIn(registration.uid!))
  // );

  constructor(
    private readonly repoService: FireRepoLite,
    private readonly alertController: AlertController
  ) {}

  public async checkIn(registration: IRegistration, isEdit = false) {
    const checkin = this.convertRegistrationToCheckIn(registration, isEdit);

    const result = await this.repoService
      .collection(COLLECTION_SCHEMA.registrationSearchIndex)
      .addById(checkin.customerId!, checkin)
      .pipe(take(1))
      .toPromise();

    const alert = await this.alertController.create({
      header: 'Check-In Complete',
      buttons: [
        {
          text: 'Ok',
        },
      ],
    });

    await alert.present();
    await alert.onDidDismiss();
    return Promise.resolve(result);
  }

  private convertRegistrationToCheckIn(
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
      ageGroup02: registration.children!.filter(
        (c) => c.ageGroup === AgeGroup.age02
      ).length,
      ageGroup35: registration.children!.filter(
        (c) => c.ageGroup === AgeGroup.age35
      ).length,
      ageGroup68: registration.children!.filter(
        (c) => c.ageGroup === AgeGroup.age68
      ).length,
      ageGroup911: registration.children!.filter(
        (c) => c.ageGroup === AgeGroup.age911
      ).length,
      toyTypeInfant: registration.children!.filter(
        (c) => c.toyType === ToyType.infant
      ).length,
      toyTypeBoy: registration.children!.filter(
        (c) => c.toyType === ToyType.boy
      ).length,
      toyTypeGirl: registration.children!.filter(
        (c) => c.toyType === ToyType.girl
      ).length,
      modifiedAtCheckIn: isEdit,
      zipCode: registration.zipCode!,
    };
    return stats;
  }
}
