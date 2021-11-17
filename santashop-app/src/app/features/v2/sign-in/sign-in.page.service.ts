import { Injectable, OnDestroy } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/compat/analytics';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Router } from '@angular/router';
import {
  AuthService,
  ErrorHandlerService,
  newAuthForm,
} from '@core/*';
import { AlertController, LoadingController } from '@ionic/angular';
import { IAuth, IError } from '@models/*';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { filter, take, tap } from 'rxjs/operators';

@Injectable()
export class SignInPageService implements OnDestroy {
  public readonly form = newAuthForm();
  private readonly subscriptions = new Array<Subscription>();
  public readonly recaptchaValid$ = new BehaviorSubject<boolean>(false);

  /**
   * Redirects a user if they're already signed in.
   *
   * @private
   * @memberof SignInPageService
   */
  public readonly redirectIfLoggedInSubscription =
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
    private readonly translateService: TranslateService,
    private readonly analytics: AngularFireAnalytics
  ) {
    this.subscriptions.push(this.redirectIfLoggedInSubscription.subscribe());
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  public async signIn(): Promise<void | IError> {

    if (!this.recaptchaValid$.getValue())
      return;

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

  public async onValidateRecaptcha($event: any) {
    if (!await this.validateRecaptcha($event)) {
      this.recaptchaValid$.next(false);
      await this.failedVerification();
      return;
    }

    await this.analytics.logEvent('validated-recaptcha');
    this.recaptchaValid$.next(true);
  }

  private async validateRecaptcha($event: any): Promise<boolean> {

    const status = await this.afFunctions
      .httpsCallable('verifyRecaptcha2')({ value: $event })
      .pipe(take(1))
      .toPromise();

      return Promise.resolve(status.success as boolean);
  }

  // Move to UI service
  private async failedVerification() {
    const alert = await this.alertController.create({
      header: this.translateService.instant('COMMON.VERIFICATION_FAILED'),
      message: this.translateService.instant('COMMON.VERIFICATION_FAILED_MSG'),
      buttons: [this.translateService.instant('COMMON.OK')],
    });

    await alert.present();
  }
}
