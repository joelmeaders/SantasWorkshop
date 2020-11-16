import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { UserProfile } from '../models/user-profile.model';
import { BaseHttpService } from './base-http.service';

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
