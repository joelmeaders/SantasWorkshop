import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import { ChildProfile } from '@app/core/models/child-profile.model';
import { BaseHttpService } from '@app/core/services/http/base';
import { publishReplay, refCount } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ChildProfileService extends BaseHttpService<ChildProfile> {
  
  constructor(
    private readonly db: AngularFirestore,
    private readonly functions: AngularFireFunctions
  ) {
    super(db, functions, 'children', 10);
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
