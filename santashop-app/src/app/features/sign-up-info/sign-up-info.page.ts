import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { filter, map, publishReplay, refCount, take, takeUntil } from 'rxjs/operators';
import { AuthService, IError, UserProfile } from 'santashop-core/src/public-api';
import { IRegistration, UserRegistrationService } from '../../services/user-registration.service';
import { SignUpInfoForm } from '../../shared/forms/sign-up info';

@Component({
  selector: 'app-sign-up-info',
  templateUrl: './sign-up-info.page.html',
  styleUrls: ['./sign-up-info.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignUpInfoPage implements OnDestroy {

  public readonly form: FormGroup = SignUpInfoForm.form();
  public readonly formValidationMessages = SignUpInfoForm.validationMessages();

  private readonly $destroy = new Subject<void>();

  private readonly _$loading = new Subject<boolean>();
  public readonly $loading = this._$loading.pipe(takeUntil(this.$destroy), publishReplay(1), refCount());

  private readonly $authUser = this.authService.$emailAndUid.pipe(
    takeUntil(this.$destroy),
    map((res: any) => res)
  );

  private readonly $fillInfo = this.authService.$userProfile.pipe(
    takeUntil(this.$destroy),
    filter((profile: UserProfile) => !!profile),
  ).subscribe(profile => {
    this.form.get('firstName').setValue(profile.firstName);
    this.form.get('lastName').setValue(profile.lastName);
    this.form.get('zipCode').setValue(profile.zipCode);
  });

  constructor(
    private readonly authService: AuthService,
    private readonly registrationService: UserRegistrationService,
    private readonly router: Router,
    private readonly analyticsService: AngularFireAnalytics,
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService
  ) { 
    analyticsService.setCurrentScreen('sign-up-info');
  }

  public async ngOnDestroy() {
    this.$destroy.next();
  }

  public async initializeAccount() {

    this._$loading.next(true);

    const auth = await this.$authUser.pipe(take(1)).toPromise();

    const info: IRegistration = {
      ...this.form.value,
    };

    info.emailAddress = auth.email;

    const response = await this.registrationService.initializeNewAccount(auth.email, auth.id, info)
      .then(res => {
        this._$loading.next(false);
        return true;
      })
      .catch((error) => {
        this._$loading.next(false);
        this.handleError(error);
        return false;
      });

    if (!!response) {
      this.redirectToProfile();
    }

  }

  private redirectToProfile() {
    this.router.navigate(['/profile']);
  }

  private async handleError(error: IError) {
    const alert = await this.alertController.create({
      header: this.translateService.instant('COMMON.ERROR'),
      subHeader: error.code,
      message: error.message,
      buttons: [this.translateService.instant('COMMON.OK')],
    });

    await alert.present();
  }

}
