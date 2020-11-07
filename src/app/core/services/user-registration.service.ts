import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { IError } from '@app/core/models/base/i-errors';
import { UserProfile } from '@app/core/models/user-profile.model';
import { UserProfileService } from '@app/core/services/http/user-profile.service';
import { take } from 'rxjs/operators';

export interface IRegistration {
  firstName: string;
  lastName: string;
  emailAddress: string;
  password: string;
  zipCode: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserRegistrationService {

  constructor(
    private readonly fireAuth: AngularFireAuth,
    private readonly userProfileService: UserProfileService
  ) { }

  public async registerAccount(registration: IRegistration): Promise<UserProfile> {

    return this.fireAuth.createUserWithEmailAndPassword(registration.emailAddress, registration.password).then(
      response => this.initializeNewAccount(response, registration)
    ).catch((error: IError) => {
      error.additionalInfo = "UserRegistrationService.registerAccount()"
      throw error;
    });

  }

  public initializeNewAccount(response: firebase.default.auth.UserCredential, registration: IRegistration): Promise<UserProfile> {

    const profile = this.newUserProfile(response, registration);

    return this.userProfileService.save(profile, true).pipe(take(1)).toPromise().then(
      (userProfile: UserProfile) => userProfile // ANALYTICS SIGNUP
    ).catch((error: IError) => {
      error.additionalInfo = "UserRegistrationService.initializeNewAccount()"
      throw error;
    });

  }

  private readonly newUserProfile = (response: firebase.default.auth.UserCredential, registration: IRegistration): UserProfile => {

    return {
      id: response.user.uid,
      emailAddress: response.user.email,
      firstName: registration.firstName,
      lastName: registration.lastName,
      zipCode: registration.zipCode,
      registeredOn: new Date().getTime(),
      acceptedPrivacyPolicy: new Date().getTime(),
      acceptedTermsOfService: new Date().getTime(),
    };
  }
}
