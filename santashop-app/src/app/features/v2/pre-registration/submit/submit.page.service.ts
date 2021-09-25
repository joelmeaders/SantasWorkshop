import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Router } from '@angular/router';
import { PreRegistrationService } from '@core/*';
import { take } from 'rxjs/operators';

@Injectable()
export class SubmitPageService {

  public readonly children$ = this.preregistrationService.children$;
  public readonly childCount$ = this.preregistrationService.childCount$;
  public readonly dateTimeSlot$ = this.preregistrationService.dateTimeSlot$;

  constructor(
    private readonly preregistrationService: PreRegistrationService,
    private readonly afFunctions: AngularFireFunctions,
    private readonly router: Router
  ) { }

  public async submitRegistration(): Promise<boolean> {

    const registration = 
      await this.preregistrationService.userRegistration$
        .pipe(take(1)).toPromise();

    const completeRegistrationFunction = this.afFunctions.httpsCallable('completeRegistration');

    const completionResult = await completeRegistrationFunction(registration)
      .pipe(take(1)).toPromise();

    console.log(completionResult);

    // TODO: Set up completion result
    return completionResult 
      ? this.sendToConfirmation()
      : Promise.reject(completionResult);
  }

  private sendToConfirmation(): Promise<boolean> {
    return this.router.navigate(['/pre-registration/confirmation']);
  }
}
