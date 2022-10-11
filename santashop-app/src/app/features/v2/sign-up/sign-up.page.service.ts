import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, ErrorHandlerService, FunctionsWrapper } from '@core/*';
import { AlertController, LoadingController } from '@ionic/angular';
import { IAuth, IError, IOnboardUser } from '@models/*';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { newOnboardUserForm } from './sign-up.form';

@Injectable()
export class SignUpPageService implements OnDestroy {
	public readonly form = newOnboardUserForm();
	public readonly recaptchaValid$ = new BehaviorSubject<boolean>(false);
	private readonly subscriptions = new Array<Subscription>();
	protected bhpValue?: string = undefined;

	/**
	 * Redirects a user if they're already signed in.
	 *
	 * @private
	 * @memberof SignInPageService
	 */
	public readonly redirectIfLoggedInSubscription =
		this.authService.currentUser$.pipe(
			filter((user) => !!user),
			tap(() => this.router.navigate(['/pre-registration/overview']))
		);

	constructor(
		private readonly authService: AuthService,
		private readonly functions: FunctionsWrapper,
		private readonly router: Router,
		private readonly loadingController: LoadingController,
		private readonly errorHandler: ErrorHandlerService,
		private readonly alertController: AlertController,
		private readonly translateService: TranslateService
	) {
		this.subscriptions.push(
			this.redirectIfLoggedInSubscription.subscribe()
		);
		this.form.errors$.pipe(tap((v) => console.log(v))).subscribe();
	}

	public ngOnDestroy(): void {
		this.subscriptions.forEach((subscription) =>
			subscription.unsubscribe()
		);
	}

	public async onValidateRecaptcha($event: any, bhp?: string) {
		this.bhpValue = bhp;

		if (!(await this.validateRecaptcha($event))) {
			this.recaptchaValid$.next(false);
			await this.failedVerification();
			return;
		}

		this.recaptchaValid$.next(true);
	}

	private async validateRecaptcha($event: any): Promise<boolean> {
		const status = await this.functions.httpsCallable(
			'verifyRecaptcha2'
		)({ value: $event });

		return status
			? Promise.resolve((status.data as any).success as boolean)
			: Promise.reject(false);
	}

	// Move to UI service
	private async failedVerification() {
		const alert = await this.alertController.create({
			header: this.translateService.instant('COMMON.VERIFICATION_FAILED'),
			message: this.translateService.instant(
				'COMMON.VERIFICATION_FAILED_MSG'
			),
			buttons: [this.translateService.instant('COMMON.OK')],
		});

		await alert.present();
	}

	public async onboardUser(): Promise<void> {
		if (!this.recaptchaValid$.getValue()) return;

		const onboardInfo = this.form.value;

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
						'SIGNUP.ACCOUNT_EXISTS'
					),
					subHeader: onboardInfo.emailAddress,
					message: this.translateService.instant(
						'SIGNUP.ACCOUNT_EXISTS_MESSAGE'
					),
					buttons: [
						{
							text: this.translateService.instant(
								'FORGOTPASS.RESET_PASSWORD'
							),
							role: '/reset-password',
						},
						{
							text: this.translateService.instant(
								'COMMON.SIGN_IN'
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
				this.errorHandler.handleError(error as IError);
			}
		} finally {
			await loader.dismiss();
		}
	}

	private async createAccount(value: IOnboardUser): Promise<void> {
		const accountStatusFunction = this.functions.httpsCallable(
			'newAccount'
		);
		await accountStatusFunction({ ...value, bhp: this.bhpValue });
	}

	private async signIn(value: IOnboardUser): Promise<void | IError> {
		const auth: IAuth = {
			emailAddress: value.emailAddress,
			password: value.password,
		};

		await this.authService.login(auth);
		this.router.navigate(['pre-registration/overview']);
	}
}
