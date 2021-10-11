import { Injectable, OnDestroy } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Router } from '@angular/router';
import {
  AuthService,
  ErrorHandlerService,
  IAuth,
  IError,
  newAuthForm,
} from '@core/*';
import { AlertController, LoadingController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { filter, take, tap } from 'rxjs/operators';

@Injectable()
export class SignInPageService implements OnDestroy {
  public readonly form = newAuthForm();
  private readonly subscriptions = new Array<Subscription>();

  /**
   * Redirects a user if they're already signed in.
   *
   * @private
   * @memberof SignInPageService
   */
  private readonly redirectIfLoggedInSubscription =
    this.authService.currentUser$.pipe(
      filter((user) => !!user),
      tap(() => this.router.navigate(['/pre-registration/overview']))
    );
  constructor(
    private readonly authService: AuthService,
    private readonly afFunctions: AngularFireFunctions,
    private readonly router: Router,
    private readonly loadingController: LoadingController,
    private readonly errorHandler: ErrorHandlerService,
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService
  ) {
    this.subscriptions.push(this.redirectIfLoggedInSubscription.subscribe());
  }

  public ngOnDestroy(): void {
    console.log('destroyed sign-in');
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  public async signIn($event: any): Promise<void | IError> {

    if (!await this.validateRecaptcha($event)) {
      await this.failedVerification();
      return;
    }

    const auth: IAuth = {
      ...this.form.value,
    };

    const loader = await this.loadingController.create({
      message: 'Signing in...',
    });

    await loader.present();

    try {
      await this.authService.login(auth);
      loader.message = 'Almost there...';
    } catch (error) {
      this.errorHandler.handleError(error as IError);
    } finally {
      await loader.dismiss();
    }
  }

  private async validateRecaptcha($event: any): Promise<boolean> {

    console.log($event)

    const status = await this.afFunctions
      .httpsCallable('verifyRecaptcha2')({ value: $event })
      .pipe(take(1))
      .toPromise();

      return status 
        ? Promise.resolve(status.success) 
        : Promise.reject(false);
  }

  // Move to UI service
  private async failedVerification() {
    const alert = await this.alertController.create({
      header: this.translateService.instant('SIGNUP_ACCOUNT.VERIFICATION_FAILED'),
      message: this.translateService.instant('SIGNUP_ACCOUNT.VERIFICATION_FAILED_MSG'),
      buttons: [this.translateService.instant('COMMON.OK')],
    });

    await alert.present();
  }
}
