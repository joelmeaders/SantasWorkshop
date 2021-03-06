import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
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

  private readonly authRedirectionSubscription = this.authService.$isAdmin.pipe(
    takeUntil(this.$destroy),
    filter(response => !!response)
  ).subscribe(() => {
    this.router.navigate(['/admin']);
  });

  constructor(
    private readonly authService: AuthService,
    private readonly loadingController: LoadingController,
    private readonly router: Router,
    private readonly alertController: AlertController,
  ) { }

  public async ngOnDestroy() {
    this.$destroy.next();
  }

  public async login() {

    const loginInfo = { ...this.form.value };

    if (loginInfo.emailAddress == null || loginInfo.password == null) {
      return;
    }

    await this.presentLoading();

    const result = await this.authService
      .login(loginInfo.emailAddress, loginInfo.password)
      .then(async (response) => true)
      .catch(async (error: IError) => {
        this.handleError(error);
        return false;
      });

    if (!result) {
      await this.destroyLoading();
      return;
    }

    this.router.navigate(['/admin']);
    await this.destroyLoading();
  }

  private async presentLoading() {
    const loading = await this.loadingController.create({
      duration: 3000,
      message: 'Signing in...',
      translucent: true,
      backdropDismiss: true,
    });

    await loading.present();
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
    try {
      await this.loadingController.dismiss();
    } catch { }
  }
}
