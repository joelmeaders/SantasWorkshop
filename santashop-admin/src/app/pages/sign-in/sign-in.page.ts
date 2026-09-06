import {
	ChangeDetectionStrategy,
	Component,
	inject,
	signal,
} from '@angular/core';
import {
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
	ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@santashop/core/admin';
import { config } from '../../../config';

import {
	IonContent,
	IonCard,
	IonCardHeader,
	IonCardTitle,
	IonCardContent,
	IonItem,
	IonInput,
	IonNote,
	IonToolbar,
	IonButton,
	IonGrid,
	IonRow,
	IonCol,
	AlertController,
} from '@ionic/angular/standalone';

@Component({
	selector: 'admin-sign-in',
	templateUrl: './sign-in.page.html',
	styleUrls: ['./sign-in.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ReactiveFormsModule,
		IonContent,
		IonCard,
		IonCardHeader,
		IonCardTitle,
		IonCardContent,
		IonItem,
		IonInput,
		IonNote,
		IonToolbar,
		IonButton,
		IonGrid,
		IonRow,
		IonCol,
	],
})
export class SignInPage {
	private readonly authService = inject(AuthService);

	private readonly router = inject(Router);

	private readonly alertController = inject(AlertController);

	public readonly environmentName = `${config.name}_${config.label}`;
	public readonly environmentVersion = config.version;

	protected readonly form = new UntypedFormGroup({
		emailAddress: new UntypedFormControl(undefined, [
			Validators.email,
			Validators.required,
		]),
		password: new UntypedFormControl(undefined, [Validators.required]),
	});

	protected readonly isSubmitting = signal(false);

	public async login(): Promise<void> {
		if (this.form.invalid || this.isSubmitting()) return;

		this.isSubmitting.set(true);

		try {
			await this.authService.login({ ...this.form.value });

			const token = await this.authService.getCurrentUserToken();
			if (!this.hasStaffAccess(token?.claims)) {
				await this.presentAccessDeniedAlert();
				return;
			}

			const navigated = await this.router.navigate(['/admin']);
			if (!navigated) await this.presentAccessDeniedAlert();
		} catch (error) {
			console.log(error);

			const errorString = this.getErrorMessage(error);

			let header = 'Unknown Error';

			if (errorString.includes('auth/wrong-password'))
				header = 'Wrong Password';

			if (errorString.includes('auth/user-not-found'))
				header = 'Wrong Email Address';

			if (errorString.includes('auth/too-many-requests'))
				header = 'Account locked out';

			const alert = await this.alertController.create({
				header,
				message: errorString.replace('Firebase: ', ''),
				buttons: ['Ok'],
			});

			await alert.present();
		} finally {
			this.isSubmitting.set(false);
		}
	}

	private hasStaffAccess(claims: unknown): boolean {
		if (
			typeof claims !== 'object' ||
			claims === null ||
			Array.isArray(claims)
		) {
			return false;
		}

		const claimsRecord = claims as Record<string, unknown>;
		if (claimsRecord['owner'] === true) return true;

		const roles = claimsRecord['roles'];
		return (
			Array.isArray(roles) &&
			roles.some(
				(role: unknown): boolean =>
					role === 'admin' || role === 'checkin',
			)
		);
	}

	private async presentAccessDeniedAlert(): Promise<void> {
		const alert = await this.alertController.create({
			header: 'Access Denied',
			message:
				'Your account is signed in, but it does not have staff access. Contact an administrator if you need access.',
			buttons: ['Ok'],
		});

		await alert.present();
	}

	private getErrorMessage(error: unknown): string {
		const errorRecord =
			typeof error === 'object' && error !== null
				? (error as Record<string, unknown>)
				: undefined;
		const message = errorRecord?.['message'];

		return typeof message === 'string' && message.length > 0
			? message
			: 'Unable to sign in. Please check your email and password and try again.';
	}
}
