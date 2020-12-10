import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { RegistrationHelpers } from '../helpers/registration-helpers';
import { ChildProfile } from '../models/child-profile.model';
import { Registration, IRegistrationDateTime, IChildrenInfo } from '../models/registration.model';
import { UserProfile } from '../models/user-profile.model';
import { BaseHttpService } from '../services/base-http.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FireCRUDStateless } from './fire-crud.service';

@Injectable({
  providedIn: 'root'
})
export class RegistrationService extends BaseHttpService<Registration> {

  public readonly $sentEmail = (uid: string) =>
    this.httpService.readOne('registrationemails', uid);

  public readonly $sendEmail = (email: any, uid: string) =>
    this.httpService.update('registrationemails', email, uid, true);

  constructor(
    private readonly db: AngularFirestore,
    private readonly httpService: FireCRUDStateless
  ) {
    super(db, 'registrations');
  }

  public storePartialRegistration(parent: UserProfile, dateTime: IRegistrationDateTime): Observable<Registration> {

    const registration: Registration = {
      id: parent.id,
      date: dateTime.date,
      time: dateTime.time,
      formattedDateTime: dateTime.formattedDateTime,
      zipCode: parent.zipCode
    };

    return this.save(registration, true);
  }

  public storeRegistration(parent: UserProfile, childrenArray: ChildProfile[], dateTime: IRegistrationDateTime): Observable<Registration> {

    const registration: Registration = {
      id: parent.id,
      code: RegistrationHelpers.generateId(8),
      email: parent.emailAddress,
      firstName: parent.firstName,
      lastName: parent.lastName,
      fullName: `${parent.firstName} ${parent.lastName}`,
      children: this.mapChildToChildInfo(childrenArray),
      date: dateTime.date,
      time: dateTime.time,
      formattedDateTime: dateTime.formattedDateTime,
      dateTimeRegistered: new Date(),
      zipCode: parent.zipCode
    };

    return this.save(registration, true);
  }

  private mapChildToChildInfo(childrenArray: ChildProfile[]): IChildrenInfo[] {
    return childrenArray.map(child => {
      return {
        n: child.firstName,
        t: child.toyType.charAt(0),
        a: child.ageGroup.charAt(0)
      } as IChildrenInfo;
    });
  }

  private readonly getRegistrationByParentQuery = (parentId: string) =>
    this.collectionRef
      .where('id', '==', parentId)
      .limit(1)

  public getRegistrationByParent(parentId: string) {
    return this.readMany(this.getRegistrationByParentQuery(parentId)).pipe(
        map(response => response[0])
      );
  }
}
