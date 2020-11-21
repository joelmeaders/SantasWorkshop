import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { publishReplay, refCount, take, takeUntil } from 'rxjs/operators';
import { AuthService, IError } from 'santashop-core/src/public-api';
import { SignInForm } from '../../forms/sign-in';

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

  constructor(
    private readonly authService: AuthService,
    private readonly loadingController: LoadingController,
    private readonly router: Router,
    private readonly alertController: AlertController,
  ) { }

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
        return true;
      }).catch(async (error: IError) => {
        this._$loading.next(false);

        if (error.code == '11') {
          this.handleIDBFatalError();
        } else {
          await this.handleError(error);
        }

        return false;
      });

    if (!result) {
      return;
    }

    // const profile = await this.authService.$userProfile.pipe(take(1)).toPromise();
    this.router.navigate(['/admin']);

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

  private async handleIDBFatalError() {
    const alert = await this.alertController.create({
      header: `Device Issue`,
      message: `Please try again using a different browser or device. We apologize for the inconvenience`,
      buttons: ['Ok'],
    });

    await alert.present();
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

  private async destroyLoading() {
    await this.loadingController.dismiss();
  }
}
