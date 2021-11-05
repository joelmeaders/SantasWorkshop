import { Injectable, OnDestroy } from '@angular/core';
import { IUser } from '@core/*';
import { ErrorHandlerService, AuthService, FireRepoLite, COLLECTION_SCHEMA } from '@core/*';
import { AlertController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { changeEmailForm, changePasswordForm, editProfileForm } from './profile.form';

@Injectable()
export class ProfilePageService implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly profileForm = editProfileForm();
  public readonly changeEmailForm = changeEmailForm();
  public readonly changePasswordForm = changePasswordForm();

  private readonly getUser$ = (uuid: string) =>
    this.httpService.collection(COLLECTION_SCHEMA.users)
      .read<IUser>(uuid).pipe(take(1));

  public readonly userProfile$ = this.authService.currentUser$.pipe(
    takeUntil(this.destroy$),
    switchMap(user => this.getUser$(user!.uid))
  );

  public readonly setUserFormSubscription = this.userProfile$.pipe(
    takeUntil(this.destroy$),
    tap(user => {
      this.profileForm.patchValue({
        firstName: user.firstName,
        lastName: user.lastName,
        zipCode: user.zipCode
      })
    })
  ).subscribe();

  constructor(
    private readonly httpService: FireRepoLite,
    private readonly authService: AuthService,
    private readonly errorHandler: ErrorHandlerService,
    private readonly alertController: AlertController
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // TODO: Cloud Function
  public async updatePublicProfile() {
    // const profile: IUser = this.profileForm.value;
    // this.profileForm.markAsPristine();
    // return await this.profileService.updatePublicProfile(profile).pipe(take(1)).toPromise();
  }

  public async changeEmailAddress(): Promise<void> {
    const value = this.changeEmailForm.value;
    await this.authService.changeEmailAddress(value.password, value.newEmailAddress)
      .then(() => this.emailChangedAlert())
      .catch(error => this.errorHandler.handleError(error));
    this.changeEmailForm.reset();
  }

  public async changePassword(): Promise<void> {
    const value = this.changePasswordForm.value;
    await this.authService.changePassword(value.oldPassword, value.newPassword)
      .then(() => this.passwordChangedAlert())
      .catch(error => this.errorHandler.handleError(error));
  }

  public async emailChangedAlert(): Promise<any> {
    const alert = await this.alertController.create({
      header: 'Email Verification Sent',
      message: 'An email has been sent to your existing address to verify the change.',
      buttons: ['Ok']
    });

    await alert.present();
    return alert.onDidDismiss();
  }

  public async passwordChangedAlert(): Promise<any> {
    const alert = await this.alertController.create({
      header: 'Password Changed',
      message: 'Remember to use your new password next time you sign in',
      buttons: ['Ok']
    });

    await alert.present();
    return alert.onDidDismiss();
  }
}
