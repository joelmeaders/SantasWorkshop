import { Injectable, OnDestroy } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Router } from '@angular/router';
import { AuthService, ErrorHandlerService, IError, IOnboardUser } from '@core/*';
import { LoadingController } from '@ionic/angular';
import { ControlsValue } from '@ngneat/reactive-forms/lib/types';
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
      tap(() => this.router.navigate(['pre-registration/overview']))
    );

  constructor(
    private readonly authService: AuthService,
    private readonly afFunctions: AngularFireFunctions,
    private readonly router: Router,
    private readonly loadingController: LoadingController,
    private readonly errorHandler: ErrorHandlerService,
  ) {
    this.subscriptions.push(this.redirectIfLoggedInSubscription.subscribe());
    this.form.validateOn(this.passwordMatchValidator$);
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  public async onboardUser(): Promise<void> {

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
}
