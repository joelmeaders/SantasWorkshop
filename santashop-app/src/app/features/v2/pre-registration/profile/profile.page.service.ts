import { Injectable, OnDestroy } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Router } from '@angular/router';
import { ErrorHandlerService, AuthService, FireRepoLite } from '@core/*';
import { AlertController, LoadingController } from '@ionic/angular';
import { COLLECTION_SCHEMA, IUser, IChangeUserInfo, IError } from '@models/*';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { newChangeInfoForm } from './change-info/change-info.form';
import { changeEmailForm, changePasswordForm } from './profile.form';

@Injectable()
export class ProfilePageService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  public readonly profileForm = newChangeInfoForm();
  public readonly changeEmailForm = changeEmailForm();
  public readonly changePasswordForm = changePasswordForm();

  private readonly getUser$ = (uuid: string) =>
    this.httpService
      .collection<IUser>(COLLECTION_SCHEMA.users)
      .read(uuid)
      .pipe(take(1));

  public readonly userProfile$ = this.authService.currentUser$.pipe(
    takeUntil(this.destroy$),
    switchMap((user) => this.getUser$(user!.uid))
  );

  public readonly setUserFormSubscription = this.userProfile$
    .pipe(
      takeUntil(this.destroy$),
      tap((user) => {
        this.profileForm.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          zipCode: user.zipCode,
        });
      })
    )
    .subscribe();

  constructor(
    private readonly httpService: FireRepoLite,
    private readonly authService: AuthService,
    private readonly afFunctions: Functions,
    private readonly errorHandler: ErrorHandlerService,
    private readonly alertController: AlertController,
    private readonly loadingController: LoadingController,
    private readonly router: Router,
    private readonly translateService: TranslateService,
    private readonly analytics: Analytics
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public async updatePublicProfile(): Promise<void> {
    await logEvent(this.analytics, 'profile_update_info');

    const newInfo: IChangeUserInfo = this.profileForm.value;

    const loader = await this.loadingController.create({
      message: 'Updating account...',
    });

    await loader.present();

    const accountStatusFunction = httpsCallable(
      this.afFunctions,
      'changeAccountInformation'
    );

    try {
      await accountStatusFunction(newInfo);
      this.router.navigate(['../']);
    } catch (error) {
      this.errorHandler.handleError(error as IError);
    } finally {
      await loader.dismiss();
    }
  }

  public async changeEmailAddress(): Promise<void> {
    await logEvent(this.analytics, 'profile_update_email');
    const value = this.changeEmailForm.value;
    await this.authService
      .changeEmailAddress(value.password, value.emailAddress)
      .then(() => this.emailChangedAlert())
      .catch((error) => this.errorHandler.handleError(error));
    this.changeEmailForm.reset();
    this.router.navigate(['../']);
  }

  public async changePassword(): Promise<void> {
    await logEvent(this.analytics, 'profile_update_password');
    const value = this.changePasswordForm.value;
    await this.authService
      .changePassword(value.oldPassword, value.newPassword)
      .then(() => this.passwordChangedAlert())
      .catch((error) => this.errorHandler.handleError(error));
    this.router.navigate(['../']);
  }

  public async emailChangedAlert(): Promise<any> {
    const alert = await this.alertController.create({
      header: this.translateService.instant('PROFILE.DONE'),
      message: this.translateService.instant('PROFILE.EMAIL_UPDATED'),
      buttons: ['Ok'],
    });

    await alert.present();
    return alert.onDidDismiss();
  }

  public async passwordChangedAlert(): Promise<any> {
    const alert = await this.alertController.create({
      header: this.translateService.instant('PROFILE.PASSWORD_CHANGED'),
      message: this.translateService.instant('PROFILE.PASSWORD_CHANGED_TEXT'),
      buttons: ['Ok'],
    });

    await alert.present();
    return alert.onDidDismiss();
  }
}
