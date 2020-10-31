import { Injectable } from '@angular/core';
import { IChildrenInfo, IRegistrationDateTime, Registration } from '@app/core/models/registration.model';
import { BaseHttpService } from '@app/core/services/http/base';
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import { UserProfile } from '@app/core/models/user-profile.model';
import { ChildProfile } from '@app/core/models/child-profile.model';
import { Observable } from 'rxjs';
import { map, publishReplay, refCount } from 'rxjs/operators';
import { Helpers } from '@app/shared/helpers';

@Injectable({
  providedIn: 'root'
})
export class RegistrationService extends BaseHttpService<Registration> {

  constructor(
    private readonly db: AngularFirestore,
    private readonly functions: AngularFireFunctions
  ) {
    super(db, functions, 'registrations', 10);
  }

  public storePartialRegistration(parent: UserProfile, dateTime: IRegistrationDateTime): Observable<Registration> {

    const registration: Registration = {
      id: parent.id,
      date: dateTime.date,
      time: dateTime.time
    };

    return this.save(registration, true);

  }

  public storeRegistration(parent: UserProfile, childrenArray: ChildProfile[], dateTime: IRegistrationDateTime): Observable<Registration> {

    const registration: Registration = {
      id: parent.id,
      code: Helpers.generateId(8),
      email: parent.emailAddress,
      name: `${parent.firstName} ${parent.lastName}`,
      children: this.mapChildToChildInfo(childrenArray),
      date: dateTime.date,
      time: dateTime.time
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
