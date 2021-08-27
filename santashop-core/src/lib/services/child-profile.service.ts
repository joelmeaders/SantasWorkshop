import { Injectable } from '@angular/core';
import { IChild } from '../models/child.model';
import { FireRepoLite } from './fire-repo-lite.service';
import { COLLECTION_SCHEMA } from '../helpers';
import { ArgumentUndefinedError } from '../models/error.model';
import { Observable } from 'rxjs';
import { DocumentReference } from '@angular/fire/compat/firestore';

@Injectable()
export class ChildProfileService {

  private readonly childrenCollection = 
    this.fireRepo.collection(COLLECTION_SCHEMA.children);
  
  constructor(private readonly fireRepo: FireRepoLite) {
  }

  public saveChild(child: IChild): Observable<DocumentReference<IChild>> {

    if (child.uid == undefined)
      throw new ArgumentUndefinedError(`child`);

    return this.childrenCollection.addById<IChild>(child.uid, child);
  }

  public getChildrenByUid(uid: string) {

    if (uid == undefined)
      throw new ArgumentUndefinedError(`registration`);
      
    return this.childrenCollection.readMany<IChild>(
      (query) => query
        .orderBy('firstName')
        .where('uid', '==', uid)
        .limit(15)
    )
  }
}
