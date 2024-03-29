import { Injectable, OnDestroy } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Router } from '@angular/router';
import { AuthService, ErrorHandlerService, newAuthForm } from '@santashop/core';
import { AlertController, LoadingController } from '@ionic/angular';
import { Auth, IError } from '@santashop/models';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { filter, tap } from 'rxjs/operators';

@Injectable()
export class SignInPageService implements OnDestroy {
	public readonly form = newAuthForm();
	private readonly subscriptions = new Array<Subscription>();
	public readonly recaptchaValid$ = new BehaviorSubject<boolean>(false);

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
		private readonly afFunctions: Functions,
		private readonly router: Router,
		private readonly loadingController: LoadingController,
		private readonly errorHandler: ErrorHandlerService,
		private readonly alertController: AlertController,
		private readonly translateService: TranslateService,
		private readonly analytics: Analytics,
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

	public async signIn(): Promise<void | IError> {
		if (!this.recaptchaValid$.getValue()) return;

		const auth: Auth = {
			...this.form.value,
		};

		const loader = await this.loadingController.create({
			message: 'Signing in...',
		});

		await loader.present();

		try {
			await this.authService.login(auth);
			loader.message = 'Almost there...';
		} catch (error) {
			this.errorHandler.handleError(error as IError);
		} finally {
			await loader.dismiss();
		}
	}

	public async onValidateRecaptcha($event: any): Promise<void> {
		if (!(await this.validateRecaptcha($event))) {
			this.recaptchaValid$.next(false);
			await this.failedVerification();
			return;
		}

		logEvent(this.analytics, 'validated_recaptcha');
		this.recaptchaValid$.next(true);
	}

	private async validateRecaptcha($event: any): Promise<boolean> {
		const status = await httpsCallable(
			this.afFunctions,
			'verifyRecaptcha2',
		)({ value: $event });
		return Promise.resolve((status.data as any).success as boolean);
	}

	// Move to UI service
	private async failedVerification(): Promise<void> {
		const alert = await this.alertController.create({
			header: this.translateService.instant('COMMON.VERIFICATION_FAILED'),
			message: this.translateService.instant(
				'COMMON.VERIFICATION_FAILED_MSG',
			),
			buttons: [this.translateService.instant('COMMON.OK')],
		});

		await alert.present();
	}
}
