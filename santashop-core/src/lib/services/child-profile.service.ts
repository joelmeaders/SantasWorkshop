import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { ChildProfile } from '../models/child-profile.model';
import { BaseHttpService } from './base-http.service';
import { publishReplay, refCount } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ChildProfileService extends BaseHttpService<ChildProfile> {
  
  constructor(
    private readonly db: AngularFirestore,
  ) {
    super(db, 'children');
  }

  private readonly getChildrenByParentQuery = (parentId: string) => 
    this.collectionRef
      .orderBy('firstName')
      .where('parentId', '==', parentId)
      .limit(15);

  public getChildrenByParent(parentId: string) {
    return this.readMany(this.getChildrenByParentQuery(parentId)).pipe(
      publishReplay(1),
      refCount()
    );
  }
}
