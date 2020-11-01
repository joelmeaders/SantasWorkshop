import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { IError } from '@app/core/models/base/i-errors';
import { UserProfile } from '@app/core/models/user-profile.model';
import { AuthService } from '@app/core/services/auth.service';
import { IRegistration, UserRegistrationService } from '@app/core/services/user-registration.service';
import { SignUpForm } from '@app/shared/forms/sign-up';
import { LegalHelpers } from '@app/shared/legal';
import { AlertController, LoadingController, ModalController } from '@ionic/angular';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { takeUntil, publishReplay, refCount, filter, shareReplay, take } from 'rxjs/operators';

@Component({
  selector: 'app-sign-up',
  templateUrl: './sign-up.page.html',
  styleUrls: ['./sign-up.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUpPage implements OnDestroy {
  public readonly form: FormGroup = SignUpForm.form();
  public readonly formValidationMessages = SignUpForm.validationMessages();

  public readonly $error = new Subject<IError>();
  private readonly $destroy = new Subject<void>();

  private readonly _$loading = new Subject<boolean>();
  public readonly $loading = this._$loading.pipe(takeUntil(this.$destroy), publishReplay(1), refCount());

  private readonly _$showPassword = new BehaviorSubject<boolean>(false);
  public readonly $showPassword = this._$showPassword.pipe(takeUntil(this.$destroy), shareReplay(1));

  private readonly isLoggedInRedirect = this.authService.$currentUser
    .pipe(
      take(2),
      filter((user) => !!user && !!user.uid)
    )
    .subscribe(() => this.router.navigate(['/profile']));

  constructor(
    private readonly userRegistrationService: UserRegistrationService,
    private readonly loadingController: LoadingController,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly alertController: AlertController,
    private readonly modalController: ModalController,
    private readonly analyticsService: AngularFireAnalytics
  ) {
    analyticsService.setCurrentScreen('sign-up');
    analyticsService.logEvent('screen_view');
  }

  public async ngOnDestroy() {
    this.$destroy.next();
    try {
      await this.loadingController.dismiss();
    } catch {
      // Do nothing
    }
  }

  public togglePassword(): void {
    const current = this._$showPassword.getValue();
    this._$showPassword.next(!current);
  }

  public async createAccount() {
    this._$loading.next(true);

    const info: IRegistration = {
      ...this.form.value,
    };

    const result = await this.userRegistrationService
      .registerAccount(info)
      .then((resolve: UserProfile) => {
        this._$loading.next(false);
        this.analyticsService.logEvent('sign_up');
        return true;
      })
      .catch(async (error: IError) => {
        this._$loading.next(false);
        await this.handleError(error);
        return false;
      });

    if (result) {
      this.redirectToAccount();
    }
  }

  private redirectToAccount() {
    this.router.navigate(['/profile']);
  }

  private readonly showLoadingSubscription = this.$loading
    .pipe(takeUntil(this.$destroy))
    .subscribe((loading) => (loading ? this.presentLoading() : this.destroyLoading()));

  private async presentLoading() {
    const loading = await this.loadingController.create({
      duration: 3000,
      message: 'Creating your account!',
      translucent: true,
      backdropDismiss: true,
    });
    await loading.present();
  }

  private async destroyLoading() {
    await this.loadingController.dismiss();
  }

  private async handleError(error: IError) {
    const alert = await this.alertController.create({
      header: 'Error',
      subHeader: error.code,
      message: error.message,
      buttons: ['Ok'],
    });

    await alert.present();
  }

  public async privacy() {
    await LegalHelpers.privacyPolicy(this.modalController);
  }

  public async terms() {
    await LegalHelpers.termsOfService(this.modalController);
  }
}
