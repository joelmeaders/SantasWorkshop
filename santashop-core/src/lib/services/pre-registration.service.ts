import { Injectable } from '@angular/core';
import { DocumentReference } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { COLLECTION_SCHEMA } from '../helpers/schema.model';
import { ArgumentUndefinedError } from '../models/error.model';
import { IRegistration } from '../models/registration.model';
import { FireRepoLite, IFireRepoCollection } from './fire-repo-lite.service';

@Injectable()
export class PreRegistrationService {

  private readonly registrationCollection: IFireRepoCollection
    = this.fireRepo.collection(COLLECTION_SCHEMA.registrations); 

  constructor(
    private readonly fireRepo: FireRepoLite,
  ) { }

  public saveRegistration(registration: IRegistration): Observable<DocumentReference<IRegistration>> {

    if (registration.uid == undefined)
      throw new ArgumentUndefinedError(`registration`);

    return this.registrationCollection.addById<IRegistration>(registration.uid, registration);
  }

  public getRegistrationByUid(uid: string) : Observable<IRegistration | undefined> {
    return this.registrationCollection.readMany<IRegistration>(
      (query) => query.where(`uid`, `==`, uid))
      .pipe(
        map(array => array[0] ?? undefined)
      );
  }
}
