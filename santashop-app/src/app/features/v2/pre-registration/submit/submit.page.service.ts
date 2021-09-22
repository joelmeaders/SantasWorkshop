import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { PreRegistrationService } from '@core/*';
import { take } from 'rxjs/operators';

@Injectable()
export class SubmitPageService {

  

  constructor(
    private readonly preregistrationService: PreRegistrationService,
    private readonly afFunctions: AngularFireFunctions
  ) { }

  public async submitRegistration() {

    const registration = 
      await this.preregistrationService.userRegistration$
        .pipe(take(1)).toPromise();

    const accountStatusFunction = this.afFunctions.httpsCallable('submitRegistration');

    return accountStatusFunction({ ...registration })
      .pipe(take(1)).toPromise();
  }

}
