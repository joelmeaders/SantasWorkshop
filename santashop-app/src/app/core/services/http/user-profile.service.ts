import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { UserProfile } from '@app/core/models/user-profile.model';
import { BaseHttpService } from '@app/core/services/http/base';

@Injectable({
  providedIn: 'root'
})
export class UserProfileService extends BaseHttpService<UserProfile> {

  constructor(
    private readonly db: AngularFirestore,
  ) {
    super(db, 'customers');
  }
}
