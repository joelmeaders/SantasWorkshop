import { Injectable, OnDestroy } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Router } from '@angular/router';
import { ErrorHandlerService, AuthService, FireRepoLite } from '@core/*';
import { AlertController, LoadingController } from '@ionic/angular';
import { COLLECTION_SCHEMA, IUser, IChangeUserInfo, IError } from '@models/*';
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
    private readonly afFunctions: AngularFireFunctions,
    private readonly errorHandler: ErrorHandlerService,
    private readonly alertController: AlertController,
    private readonly loadingController: LoadingController,
    private readonly router: Router
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public async updatePublicProfile(): Promise<void> {

    const newInfo: IChangeUserInfo = this.profileForm.value;

    const loader = await this.loadingController.create(
      { message: 'Updating account...' });

    await loader.present();

    const accountStatusFunction = this.afFunctions.httpsCallable('changeAccountInformation');

    try {
      await accountStatusFunction(newInfo)
        .pipe(take(1)).toPromise();
      
      this.router.navigate(['../']);
    }
    catch (error) {
      this.errorHandler.handleError(error as IError);
    }
    finally {
      await loader.dismiss();
    }
  }

  public async changeEmailAddress(): Promise<void> {
    const value = this.changeEmailForm.value;
    await this.authService.changeEmailAddress(value.password, value.emailAddress)
      .then(() => this.emailChangedAlert())
      .catch(error => this.errorHandler.handleError(error));
    this.changeEmailForm.reset();
    this.router.navigate(['../']);
  }

  public async changePassword(): Promise<void> {
    const value = this.changePasswordForm.value;
    await this.authService.changePassword(value.oldPassword, value.newPassword)
      .then(() => this.passwordChangedAlert())
      .catch(error => this.errorHandler.handleError(error));
      this.router.navigate(['../']);
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
