import { Injectable } from '@angular/core';
import { DocumentReference } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { COLLECTION_SCHEMA } from '../helpers/schema.model';
import { ArgumentUndefinedError } from '../models/error.model';
import { IUser } from '../models/user.model';
import { FireRepoLite, IFireRepoCollection } from './fire-repo-lite.service';

@Injectable()
export class UserProfileService {

  private readonly usersCollection: IFireRepoCollection
    = this.fireRepo.collection(COLLECTION_SCHEMA.users); 

  constructor(
    private readonly fireRepo: FireRepoLite,
  ) { }

  public saveUser(user: IUser): Observable<DocumentReference<IUser>> {

    if (user.uid == undefined)
      throw new ArgumentUndefinedError(`registration`);

    return this.usersCollection.addById<IUser>(user.uid, user);
  }

  public getUserByUid(uid: string) : Observable<IUser | undefined> {
    return this.usersCollection.read<IUser>(uid, `uid`);
  }
}
