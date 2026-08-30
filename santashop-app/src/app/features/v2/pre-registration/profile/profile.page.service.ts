import { Injectable, OnDestroy, inject } from '@angular/core';
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
import { AlertController, LoadingController } from '@ionic/angular/standalone';
import {
	COLLECTION_SCHEMA,
	User,
	ChangeUserInfo,
	IError,
} from '@santashop/models';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import { map, shareReplay, switchMap, takeUntil, tap } from 'rxjs/operators';
import { newChangeInfoForm } from './change-info/change-info.form';
import { changeEmailForm, changePasswordForm } from './profile.form';

@Injectable({
	providedIn: 'root',
})
export class ProfilePageService implements OnDestroy {
	private readonly httpService = inject(FireRepoLite);
	private readonly authService = inject(AuthService);
	private readonly functions = inject(FunctionsWrapper);
	private readonly errorHandler = inject(ErrorHandlerService);
	private readonly alertController = inject(AlertController);
	private readonly loadingController = inject(LoadingController);
	private readonly router = inject(Router);
	private readonly translateService = inject(TranslateService);
	private readonly analytics = inject(AnalyticsWrapper);

	private readonly destroy$ = new Subject<void>();
	private readonly profileUpdates$ = new BehaviorSubject<Partial<User>>({});

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
			.pipe(filterNil());

	@automock
	public readonly userProfile$ = this.authService.currentUser$.pipe(
		filterNil(),
		takeUntil(this.destroy$),
		switchMap((user) =>
			combineLatest([
				this.getUser$(user.uid),
				this.profileUpdates$,
			]).pipe(map(([profile, updates]) => ({ ...profile, ...updates }))),
		),
		shareReplay(1),
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

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public async updatePublicProfile(): Promise<void> {
		this.analytics.logEvent('profile_update_info');

		const newInfo = this.profileForm.value as ChangeUserInfo;

		const loader = await this.loadingController.create({
			message: 'Updating account...',
		});

		await loader.present();

		try {
			await this.functions.changeAccountInformation(newInfo);
			this.profileUpdates$.next({
				...this.profileUpdates$.value,
				...newInfo,
				zipCode: String(newInfo.zipCode),
			});
			this.router.navigate(['/pre-registration/profile']);
		} catch (error) {
			await this.errorHandler.handleError(error as IError);
		} finally {
			await loader.dismiss().catch(() => false);
		}
	}

	public async changeEmailAddress(): Promise<void> {
		this.analytics.logEvent('profile_update_email');

		const value = this.changeEmailForm.value;

		await this.authService
			.changeEmailAddress(value.password!, value.emailAddress!)
			.then(() => this.emailChangedAlert())
			.catch((error) => this.errorHandler.handleError(error));

		this.changeEmailForm.reset();

		this.router.navigate(['/pre-registration/profile']);
	}

	public async changePassword(): Promise<void> {
		this.analytics.logEvent('profile_update_password');

		const value = this.changePasswordForm.value;

		await this.authService
			.changePassword(value.oldPassword!, value.newPassword!)
			.then(() => this.passwordChangedAlert())
			.catch((error) => this.errorHandler.handleError(error));

		this.router.navigate(['/pre-registration/profile']);
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
			message: this.translateService.instant(
				'PROFILE.PASSWORD_CHANGED_TEXT',
			),
			buttons: ['Ok'],
		});

		await alert.present();
		return alert.onDidDismiss();
	}
}
