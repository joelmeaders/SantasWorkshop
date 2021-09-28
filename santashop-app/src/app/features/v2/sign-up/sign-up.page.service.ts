import { Injectable, OnDestroy } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Router } from '@angular/router';
import { AuthService, ErrorHandlerService, IError, IOnboardUser } from '@core/*';
import { AlertController, LoadingController } from '@ionic/angular';
import { ControlsValue } from '@ngneat/reactive-forms/lib/types';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { filter, map, take, tap } from 'rxjs/operators';
import { IAuth } from 'santashop-core/src/lib/models/auth.model';
import { newOnboardUserForm } from './sign-up.form';

@Injectable()
export class SignUpPageService implements OnDestroy {

  public readonly form = newOnboardUserForm();
  private readonly subscriptions = new Array<Subscription>();

  /**
   * Returns a value indicating if the passwords 
   * entered by the user match.
   * 
   * @private
   * @returns Observable<{fieldsMatch:boolean}>
   */
  private readonly passwordMatchValidator$: Observable<{fieldsMatch:boolean}> = combineLatest([
    this.form.select(state => state.password),
    this.form.select(state => state.password2)
  ]).pipe(
    filter(([password, repeat]) => !!password && !!repeat),
    map(([password, repeat]) => 
      password === repeat ? { fieldsMatch: false } : { fieldsMatch: true })
  );

  /**
   * Redirects a user if they're already signed in.
   *
   * @private
   * @memberof SignInPageService
   */
  private readonly redirectIfLoggedInSubscription =
    this.authService.currentUser$.pipe(
      filter(user => !!user),
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
    this.form.validateOn(this.passwordMatchValidator$);
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  public async onboardUser($event: any): Promise<void> {

    if (!await this.validateRecaptcha($event)) {
      await this.failedVerification();
    }

    const onboardInfo = this.form.value;

    const loader = await this.loadingController.create(
      { message: 'Creating account...' });

    await loader.present();

    try {
      await this.createAccount(onboardInfo);
      loader.message = 'Logging you in';
      await this.signIn(onboardInfo);
    } 
    catch(error) {
      this.errorHandler.handleError(error as IError);
    }
    finally {
      await loader.dismiss();
    }
  }

  private async createAccount(value: ControlsValue<IOnboardUser>): Promise<void> {
    const accountStatusFunction = this.afFunctions.httpsCallable('newAccount');
    return accountStatusFunction({ ...value })
      .pipe(take(1)).toPromise();
  }

  private async signIn(value: ControlsValue<IOnboardUser>): Promise<void | IError> {

    const auth: IAuth = {
      emailAddress: value.emailAddress,
      password: value.password
    };

    await this.authService.login(auth);
  }

  private async validateRecaptcha($event: any): Promise<boolean> {
    const status = await this.afFunctions
      .httpsCallable('verifyRecaptcha')({ value: $event })
      .pipe(take(1))
      .toPromise();

      return status 
        ? Promise.resolve(status) 
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
