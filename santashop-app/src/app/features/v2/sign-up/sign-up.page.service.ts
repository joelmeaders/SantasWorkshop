import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
	AuthService,
	ErrorHandlerService,
	FunctionsWrapper,
} from '@santashop/core';
import { AlertController, LoadingController } from '@ionic/angular';
import { Auth, IError, OnboardUser } from '@santashop/models';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { newOnboardUserForm } from './sign-up.form';

@Injectable()
export class SignUpPageService implements OnDestroy {
	public readonly form = newOnboardUserForm();
	private readonly subscriptions = new Array<Subscription>();

	/**
	 * Redirects a user if they're already signed in.
	 *
	 * @private
	 * @memberof SignInPageService
	 */
	public readonly redirectIfLoggedInSubscription =
		this.authService.currentUser$.pipe(
			filter((user) => !!user),
			tap(() => this.router.navigate(['/pre-registration/overview'])),
		);

	constructor(
		private readonly authService: AuthService,
		private readonly functions: FunctionsWrapper,
		private readonly router: Router,
		private readonly loadingController: LoadingController,
		private readonly errorHandler: ErrorHandlerService,
		private readonly alertController: AlertController,
		private readonly translateService: TranslateService,
	) {
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
			message: 'Creating account...',
		});

		await loader.present();

		try {
			await this.createAccount(onboardInfo);
			loader.message = 'Logging you in';
			await this.signIn(onboardInfo);
		} catch (incomingError) {
			const error = incomingError as IError;

			if ((error as IError).code === 'functions/already-exists') {
				await loader.dismiss();
				const alert = await this.alertController.create({
					header: this.translateService.instant(
						'SIGNUP.ACCOUNT_EXISTS',
					),
					subHeader: onboardInfo.emailAddress,
					message: this.translateService.instant(
						'SIGNUP.ACCOUNT_EXISTS_MESSAGE',
					),
					buttons: [
						{
							text: this.translateService.instant(
								'FORGOTPASS.RESET_PASSWORD',
							),
							role: '/reset-password',
						},
						{
							text: this.translateService.instant(
								'COMMON.SIGN_IN',
							),
							role: '/sign-in',
						},
					],
					backdropDismiss: false,
				});

				await alert.present();

				await alert.onDidDismiss().then((response) => {
					this.router.navigate([response.role]);
				});
			} else {
				this.errorHandler.handleError(error);
			}
		} finally {
			await loader.dismiss();
		}
	}

	private async createAccount(value: OnboardUser): Promise<void> {
		const accountStatusFunction =
			this.functions.callableWrapper('newAccount');
		await accountStatusFunction({ ...value });
	}

	private async signIn(value: OnboardUser): Promise<void | IError> {
		const auth: Auth = {
			emailAddress: value.emailAddress,
			password: value.password,
		};

		await this.authService.login(auth);
		this.router.navigate(['pre-registration/overview']);
	}
}
