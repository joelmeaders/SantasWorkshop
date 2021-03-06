import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { take } from 'rxjs/operators';
import { IError, UserProfile, UserProfileService } from 'santashop-core/src/public-api';

export interface IRegistration {
  firstName: string;
  lastName: string;
  emailAddress: string;
  password: string;
  zipCode: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserRegistrationService {
  constructor(private readonly fireAuth: AngularFireAuth, private readonly userProfileService: UserProfileService) {}

  public async registerAccount(registration: IRegistration): Promise<firebase.default.auth.UserCredential> {
    return this.fireAuth.createUserWithEmailAndPassword(registration.emailAddress, registration.password)
    .catch((error: IError) => {
      error.additionalInfo = 'UserRegistrationService.registerAccount()';
      throw error;
    });
  }

  public initializeNewAccount(emailAddress: string, uid: string, registration: IRegistration): Promise<UserProfile> {
    const profile = this.newUserProfile(emailAddress, uid, registration);

    return this.userProfileService
      .save(profile, true)
      .pipe(take(1))
      .toPromise()
      .then(
        (userProfile: UserProfile) => userProfile // ANALYTICS SIGNUP
      )
      .catch((error: IError) => {
        error.additionalInfo = 'UserRegistrationService.initializeNewAccount()';
        throw error;
      });
  }

  private readonly newUserProfile = (emailAddress: string, uid: string, registration: IRegistration): UserProfile => {
    return {
      id: uid,
      emailAddress: emailAddress,
      firstName: registration.firstName,
      lastName: registration.lastName,
      zipCode: registration.zipCode,
      acceptedPrivacyPolicy: new Date(),
      acceptedTermsOfService: new Date(),
    };
  };
}
