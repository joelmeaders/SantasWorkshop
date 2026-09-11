import { Injectable, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
	ErrorHandlerService,
	AuthService,
	FireRepoLite,
	AnalyticsWrapper,
	FunctionsWrapper,
} from '@santashop/core';
import { AlertController, LoadingController } from '@ionic/angular/standalone';
import {
	COLLECTION_SCHEMA,
	User,
	ChangeUserInfo,
	IError,
} from '@santashop/models';
import { TranslateService } from '@ngx-translate/core';
import {
	BehaviorSubject,
	combineLatest,
	Observable,
	Subject,
	of,
	defer,
	catchError,
	startWith,
} from 'rxjs';
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
	private profileUid: string | undefined;
	private profileVersion = 0;
	private readonly profileUpdates$ = new BehaviorSubject<Partial<User>>({});

	public readonly profileForm = newChangeInfoForm();

	public readonly changeEmailForm = changeEmailForm();

	public readonly changePasswordForm = changePasswordForm();

	private readonly getUser$ = (uuid: string): Observable<User | undefined> =>
		this.httpService.collection<User>(COLLECTION_SCHEMA.users).read(uuid);

	public readonly userProfile$ = this.authService.currentUser$.pipe(
		switchMap((user) => {
			if (this.profileUid !== user?.uid) {
				this.profileUid = user?.uid;
				this.profileVersion++;
				this.profileUpdates$.next({});
				this.profileForm.reset();
				this.changeEmailForm.reset();
				this.changePasswordForm.reset();
			}
			return user
				? combineLatest([
						defer(() => this.getUser$(user.uid)),
						this.profileUpdates$,
					]).pipe(
						map(([profile, updates]) =>
							profile ? { ...profile, ...updates } : undefined,
						),
						catchError(() => of(undefined)),
						startWith(undefined),
					)
				: of(undefined);
		}),
		takeUntil(this.destroy$),
		shareReplay(1),
	);

	public readonly setUserFormSubscription = this.userProfile$
		.pipe(
			takeUntil(this.destroy$),
			tap((user) => {
				if (!user) {
					this.profileForm.reset();
					return;
				}
				this.profileForm.patchValue({
					firstName: user.firstName,
					lastName: user.lastName,
					zipCode: user.zipCode,
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
		const version = this.profileVersion;

		const loader = await this.loadingController.create({
			message: 'Updating account...',
		});

		await loader.present();

		try {
			await this.functions.changeAccountInformation(newInfo);
			await this.authService.refreshCurrentUser();
			if (version !== this.profileVersion) return;
			this.profileUpdates$.next({
				...this.profileUpdates$.value,
				...newInfo,
				zipCode: newInfo.zipCode,
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
