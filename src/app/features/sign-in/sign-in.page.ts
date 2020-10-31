import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { IError } from '@app/core/models/base/i-errors';
import { AuthService } from '@app/core/services/auth.service';
import { ResetPasswordComponent } from '@app/shared/components/reset-password/reset-password.component';
import { SignInForm } from '@app/shared/forms/sign-in';
import { ModalController, LoadingController, AlertController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil, publishReplay, refCount, filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.page.html',
  styleUrls: ['./sign-in.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage implements OnDestroy {
  public readonly form: FormGroup = SignInForm.form();
  public readonly formValidationMessages = SignInForm.validationMessages();

  public readonly $error = new Subject<IError>();
  private readonly $destroy = new Subject<void>();

  private readonly _$loading = new Subject<boolean>();
  public readonly $loading = this._$loading.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  private readonly isLoggedInRedirect = this.authService.$currentUser.pipe(
    take(2),
    filter(user => !!user && !!user.uid)
  ).subscribe(
    () => this.router.navigate(['/profile'])
  );

  constructor(
    private readonly authService: AuthService,
    private readonly loadingController: LoadingController,
    private readonly router: Router,
    private readonly modalController: ModalController,
    private readonly alertController: AlertController,
    private readonly analyticsService: AngularFireAnalytics
  ) {}

  public async ngOnDestroy() {
    this.$destroy.next();
    try {
      await this.loadingController.dismiss();
    } catch {
      // Do nothing
    }
  }

  public async login() {

    const loginInfo = { ...this.form.value };

    if (loginInfo.emailAddress == null || loginInfo.password == null) {
      return;
    }

    this._$loading.next(true);

    const result = await this.authService
      .login(loginInfo.emailAddress, loginInfo.password)
      .then(async (response) => {
        this._$loading.next(false);
        this.analyticsService.logEvent('sign_up');
        return true;
      }).catch(async (error: IError) => {
        this._$loading.next(false);
        await this.handleError(error);
        return false;
      });

    if (result) {
      this.router.navigate(['/profile']);
    }

  }

  private readonly showLoadingSubscription = this.$loading
    .pipe(
      takeUntil(this.$destroy),
    )
    .subscribe((loading) => (loading ? this.presentLoading() : this.destroyLoading()));

  private async presentLoading() {
    const loading = await this.loadingController.create({
      duration: 3000,
      message: 'Signing in...',
      translucent: true,
      backdropDismiss: true,
    });
    
    await loading.present();
  }

  private async destroyLoading() {
    await this.loadingController.dismiss();
  }

  public async forgotPassword() {
    const modal = await this.modalController.create({
      component: ResetPasswordComponent,
    });

    await modal.present();
  }

  private async handleError(error: IError) {

    const alert = await this.alertController.create({
      header: 'Error',
      subHeader: error.code,
      message: error.message,
      buttons: ['Ok']
    });

    await alert.present();

  }
}
