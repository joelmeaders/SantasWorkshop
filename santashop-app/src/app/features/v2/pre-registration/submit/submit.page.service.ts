import { Injectable } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/compat/analytics';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Router } from '@angular/router';
import { ErrorHandlerService, PreRegistrationService } from '@core/*';
import { LoadingController } from '@ionic/angular';
import { IError } from '@models/*';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

@Injectable()
export class SubmitPageService {
  public readonly children$ = this.preregistrationService.children$;
  public readonly childCount$ = this.preregistrationService.childCount$;
  public readonly dateTimeSlot$ = this.preregistrationService.dateTimeSlot$;

  constructor(
    private readonly preregistrationService: PreRegistrationService,
    private readonly afFunctions: AngularFireFunctions,
    private readonly router: Router,
    private readonly analytics: AngularFireAnalytics,
    private readonly loadingController: LoadingController,
    private readonly errorHandler: ErrorHandlerService
  ) {}

  public async submitRegistration(): Promise<boolean> {
    const loader = await this.loadingController.create({
      message: 'Submitting...',
    });

    await loader.present();

    await this.analytics.logEvent('submit_registration');

    try {
      const registration = await this.preregistrationService.userRegistration$
        .pipe(take(1))
        .toPromise();

      const completeRegistrationFunction = this.afFunctions.httpsCallable(
        'completeRegistration'
      );

      const completionResult = await completeRegistrationFunction(registration)
        .pipe(
          take(1),
          catchError((err) => {
            console.error('error!!', err);
            return of(false);
          })
        )
        .toPromise();

      return completionResult
        ? this.sendToConfirmation()
        : Promise.reject(completionResult);
    } catch (error) {
      this.errorHandler.handleError(error as IError);
      return Promise.resolve(false);
    } finally {
      await loader.dismiss();
    }
  }

  private sendToConfirmation(): Promise<boolean> {
    return this.router.navigate(['/pre-registration/confirmation']);
  }
}
