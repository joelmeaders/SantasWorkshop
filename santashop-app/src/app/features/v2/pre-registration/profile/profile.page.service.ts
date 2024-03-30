import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
	ErrorHandlerService,
	AuthService,
	FireRepoLite,
	automock,
	AnalyticsWrapper,
	FunctionsWrapper,
	filterNil,
} from '@santashop/core';
import { AlertController, LoadingController } from '@ionic/angular';
import { OverlayEventDetail } from '@ionic/core';
import {
	COLLECTION_SCHEMA,
	User,
	ChangeUserInfo,
	IError,
} from '@santashop/models';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject } from 'rxjs';
import { switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { newChangeInfoForm } from './change-info/change-info.form';
import { changeEmailForm, changePasswordForm } from './profile.form';

@Injectable()
export class ProfilePageService implements OnDestroy {
	private readonly destroy$ = new Subject<void>();

	@automock
	public readonly profileForm = newChangeInfoForm();

	@automock
	public readonly changeEmailForm = changeEmailForm();

	@automock
	public readonly changePasswordForm = changePasswordForm();

	@automock
	private readonly getUser$ = (uuid: string): Observable<User> =>
		this.httpService
			.collection<User>(COLLECTION_SCHEMA.users)
			.read(uuid)
			.pipe(filterNil(), take(1));

	@automock
	public readonly userProfile$ = this.authService.currentUser$.pipe(
		takeUntil(this.destroy$),
		switchMap((user) => this.getUser$(user!.uid)),
	);

	public readonly setUserFormSubscription = this.userProfile$
		.pipe(
			takeUntil(this.destroy$),
			tap((user) => {
				this.profileForm.patchValue({
					firstName: user.firstName,
					lastName: user.lastName,
					zipCode: Number.parseInt(user.zipCode, 10),
				});
			}),
		)
		.subscribe();

	constructor(
		private readonly httpService: FireRepoLite,
		private readonly authService: AuthService,
		private readonly functions: FunctionsWrapper,
		private readonly errorHandler: ErrorHandlerService,
		private readonly alertController: AlertController,
		private readonly loadingController: LoadingController,
		private readonly router: Router,
		private readonly translateService: TranslateService,
		private readonly analytics: AnalyticsWrapper,
	) {}

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public async updatePublicProfile(): Promise<void> {
		this.analytics.logEvent('profile_update_info');

		const newInfo: ChangeUserInfo = this.profileForm.value;

		const loader = await this.loadingController.create({
			message: 'Updating account...',
		});

		await loader.present();

		try {
			await this.functions.changeAccountInformation(newInfo);
			this.router.navigate(['../']);
		} catch (error) {
			this.errorHandler.handleError(error as IError);
		} finally {
			await loader.dismiss();
		}
	}

	public async changeEmailAddress(): Promise<void> {
		this.analytics.logEvent('profile_update_email');

		const value = this.changeEmailForm.value;

		await this.authService
			.changeEmailAddress(value.password, value.emailAddress)
			.then(() => this.emailChangedAlert())
			.catch((error) => this.errorHandler.handleError(error));

		this.changeEmailForm.reset();

		this.router.navigate(['../']);
	}

	public async changePassword(): Promise<void> {
		this.analytics.logEvent('profile_update_password');

		const value = this.changePasswordForm.value;

		await this.authService
			.changePassword(value.oldPassword, value.newPassword)
			.then(() => this.passwordChangedAlert())
			.catch((error) => this.errorHandler.handleError(error));

		this.router.navigate(['../']);
	}

	public async emailChangedAlert(): Promise<OverlayEventDetail<any>> {
		const alert = await this.alertController.create({
			header: this.translateService.instant('PROFILE.DONE'),
			message: this.translateService.instant('PROFILE.EMAIL_UPDATED'),
			buttons: ['Ok'],
		});

		await alert.present();
		return alert.onDidDismiss();
	}

	public async passwordChangedAlert(): Promise<OverlayEventDetail<any>> {
		const alert = await this.alertController.create({
			header: this.translateService.instant('PROFILE.PASSWORD_CHANGED'),
			message: this.translateService.instant(
				'PROFILE.PASSWORD_CHANGED_TEXT',
			),
			buttons: ['Ok'],
		});

		await alert.present();
		return alert.onDidDismiss();
	}
}
