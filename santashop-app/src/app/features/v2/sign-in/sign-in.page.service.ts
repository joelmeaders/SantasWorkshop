import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, ErrorHandlerService, newAuthForm } from '@santashop/core';
import { LoadingController } from '@ionic/angular';
import { Auth, IError } from '@santashop/models';
import { Subscription } from 'rxjs';
import { filter, tap } from 'rxjs/operators';

@Injectable()
export class SignInPageService implements OnDestroy {
	public readonly form = newAuthForm();
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
		private readonly router: Router,
		private readonly loadingController: LoadingController,
		private readonly errorHandler: ErrorHandlerService,
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
}
