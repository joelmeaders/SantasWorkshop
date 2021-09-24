import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { PreRegistrationService } from '@core/*';
import { take } from 'rxjs/operators';

@Injectable()
export class SubmitPageService {

  public readonly children$ = this.preregistrationService.children$;
  public readonly dateTimeSlot = this.preregistrationService.dateTimeSlot$;

  constructor(
    private readonly preregistrationService: PreRegistrationService,
    private readonly afFunctions: AngularFireFunctions
  ) { }

  public async submitRegistration() {

    const registration = 
      await this.preregistrationService.userRegistration$
        .pipe(take(1)).toPromise();

    const completeRegistrationFunction = this.afFunctions.httpsCallable('completeRegistration');

    const completionResult = await completeRegistrationFunction(registration)
      .pipe(take(1)).toPromise();
  }

}
