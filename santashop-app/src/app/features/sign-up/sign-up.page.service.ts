import { Injectable, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
	AuthService,
	AnalyticsWrapper,
	trackAnalyticsOperation,
	ErrorHandlerService,
	FunctionsWrapper,
} from '@santashop/core/customer';
import { AlertController, LoadingController } from '@ionic/angular/standalone';
import { Auth, IError, OnboardUser } from '@santashop/models';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { newOnboardUserForm } from './sign-up.form';

@Injectable()
export class SignUpPageService implements OnDestroy {
	private readonly authService = inject(AuthService);
	private readonly analytics = inject(AnalyticsWrapper);
	private readonly functions = inject(FunctionsWrapper);
	private readonly router = inject(Router);
	private readonly loadingController = inject(LoadingController);
	private readonly errorHandler = inject(ErrorHandlerService);
	private readonly alertController = inject(AlertController);
	private readonly translateService = inject(TranslateService);

	public readonly form = newOnboardUserForm();
	private readonly subscriptions = new Array<Subscription>();

	/**
	 * Redirects a user if they're already signed in.
	 */
	public readonly redirectIfLoggedInSubscription =
		this.authService.currentUser$.pipe(
			filter((user) => !!user),
			tap(() => this.router.navigate(['/pre-registration/overview'])),
		);

	constructor() {
		this.subscriptions.push(
			this.redirectIfLoggedInSubscription.subscribe(),
		);
	}

	public ngOnDestroy(): void {
		this.subscriptions.forEach((subscription) =>
			subscription.unsubscribe(),
		);
	}

	public async onboardUser(): Promise<void> {
		const onboardInfo = this.form.value as OnboardUser;

		const loader = await this.loadingController.create({
			message: await firstValueFrom(
				this.translateService.get('SIGNUP.CREATING_ACCOUNT'),
			),
		});

		await loader.present();

		let accountCreated = false;
		let authenticated = false;
		try {
			await trackAnalyticsOperation(
				this.analytics,
				'create_account',
				() => this.createAccount(onboardInfo),
			);
			this.analytics.logEvent('account_created');
			accountCreated = true;
			loader.message = await firstValueFrom(
				this.translateService.get('SIGNUP.SIGNING_IN'),
			);
			await trackAnalyticsOperation(
				this.analytics,
				'signup_sign_in',
				() => this.signIn(onboardInfo),
			);
			authenticated = true;
			await this.router.navigate(['pre-registration/overview']);
		} catch (incomingError) {
			const error = incomingError as IError;

			if (accountCreated && !authenticated) {
				this.analytics.logEventWithParams('signup_recovery_shown', {
					reason: 'sign_in_failed',
				});
				await loader.dismiss().catch(() => false);
				await this.showAccountRecoveryAlert(
					onboardInfo.emailAddress,
					'SIGNUP.ACCOUNT_CREATED',
					'SIGNUP.ACCOUNT_CREATED_MESSAGE',
				);
			} else if (error?.code === 'functions/already-exists') {
				this.analytics.logEventWithParams('signup_recovery_shown', {
					reason: 'account_exists',
				});
				await loader.dismiss().catch(() => false);
				await this.showAccountRecoveryAlert(
					onboardInfo.emailAddress,
					'SIGNUP.ACCOUNT_EXISTS',
					'SIGNUP.ACCOUNT_EXISTS_MESSAGE',
				);
			} else if (error?.code === 'functions/unauthenticated') {
				await this.errorHandler.handleError(
					{
						...error,
						details: this.translateService.instant(
							'SIGNUP.VERIFICATION_FAILED_MESSAGE',
						),
					},
					this.translateService.instant('SIGNUP.VERIFICATION_FAILED'),
				);
			} else {
				await this.errorHandler.handleError(error);
			}
		} finally {
			await loader.dismiss().catch(() => false);
		}
	}

	private async showAccountRecoveryAlert(
		emailAddress: string | undefined,
		headerKey: string,
		messageKey: string,
	): Promise<void> {
		const alert = await this.alertController.create({
			header: this.translateService.instant(headerKey),
			subHeader: emailAddress,
			message: this.translateService.instant(messageKey),
			buttons: [
				{
					text: this.translateService.instant(
						'FORGOTPASS.RESET_PASSWORD',
					),
					role: 'reset',
				},
				{
					text: this.translateService.instant('COMMON.SIGN_IN'),
					role: 'sign-in',
				},
			],
			backdropDismiss: false,
		});

		await alert.present();

		await alert.onDidDismiss().then((response) => {
			this.analytics.logEventWithParams('signup_recovery_selected', {
				action:
					response.role === 'reset'
						? 'reset'
						: response.role === 'sign-in'
							? 'sign_in'
							: 'dismissed',
			});
			this.router.navigate(['/'], {
				queryParams: { mode: response.role },
			});
		});
	}

	private async createAccount(value: OnboardUser): Promise<void> {
		const accountStatusFunction =
			this.functions.callableWrapper('newAccount');
		await accountStatusFunction({
			...value,
			preferredLanguage:
				this.translateService.getCurrentLang() === 'es' ? 'es' : 'en',
		});
	}

	private async signIn(value: OnboardUser): Promise<void | IError> {
		const auth: Auth = {
			emailAddress: value.emailAddress,
			password: value.password,
		};

		await this.authService.login(auth);
	}
}
