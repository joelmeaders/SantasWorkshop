import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
	ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@santashop/core';
import { environment } from '../../../environments/environment';

import {
	IonContent,
	IonCard,
	IonCardHeader,
	IonCardTitle,
	IonCardContent,
	IonItem,
	IonLabel,
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
	standalone: true,
	imports: [
		ReactiveFormsModule,
		IonContent,
		IonCard,
		IonCardHeader,
		IonCardTitle,
		IonCardContent,
		IonItem,
		IonLabel,
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

	public readonly environmentName = `${environment.name}_${environment.label}`;
	public readonly environmentVersion = environment.version;

	protected readonly form = new UntypedFormGroup({
		emailAddress: new UntypedFormControl(undefined, [
			Validators.email,
			Validators.required,
		]),
		password: new UntypedFormControl(undefined, [Validators.required]),
	});

	public async login(): Promise<void> {
		try {
			await this.authService
				.login({ ...this.form.value })
				.then(() => this.router.navigate(['/admin']));
		} catch (error) {
			console.log(error);

			const errorCast = error as any as Error;
			const errorString = errorCast.message;

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
		}
	}
}
