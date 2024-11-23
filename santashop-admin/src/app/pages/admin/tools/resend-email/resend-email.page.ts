import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import {
	UntypedFormGroup,
	UntypedFormControl,
	Validators,
	ReactiveFormsModule,
} from '@angular/forms';
import { HttpsCallableResult } from '@santashop/core';
import {
	AlertController,
	LoadingController,
	IonContent,
	IonCardHeader,
	IonCardSubtitle,
	IonList,
	IonItem,
	IonInput,
	IonButton,
	IonIcon,
	IonLabel,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { LookupService } from '../../../../shared/services/lookup.service';
import { RegistrationSearchIndex } from '@santashop/models';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { addIcons } from 'ionicons';
import { mailOutline } from 'ionicons/icons';

@Component({
	selector: 'admin-resend-email',
	templateUrl: './resend-email.page.html',
	styleUrls: ['./resend-email.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		HeaderComponent,
		ReactiveFormsModule,
		IonContent,
		IonCardHeader,
		IonCardSubtitle,
		IonList,
		IonItem,
		IonInput,
		IonButton,
		IonIcon,
		IonLabel,
	],
})
export class ResendEmailPage {
	private readonly lookupService = inject(LookupService);
	private readonly functions = inject(Functions);
	private readonly alerts = inject(AlertController);
	private readonly loading = inject(LoadingController);

	public readonly form = new UntypedFormGroup({
		emailAddress: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: [Validators.required, Validators.email],
		}),
	});

	private readonly sendEmailFn = (
		customerId: string,
	): Promise<HttpsCallableResult<number>> =>
		httpsCallable<{ customerId: string }, number>(
			this.functions,
			'callableResendRegistrationEmail',
		)({ customerId });

	constructor() {
		addIcons({ mailOutline });
		addIcons({ mailOutline });
		addIcons({ mailOutline });
	}

	public async searchAndSend(): Promise<void> {
		const email = this.form.controls.emailAddress.value.toLowerCase();

		const index = await this.searchCustomer(email);
		if (!index) return;

		await this.sendEmail(index);

		this.form.reset();
	}

	private async searchCustomer(
		emailAddress: string,
	): Promise<RegistrationSearchIndex | undefined> {
		let index: RegistrationSearchIndex | undefined;

		try {
			const loading = await this.loading.create({
				message: 'Finding registration...',
				translucent: true,
				backdropDismiss: false,
			});

			await loading.present();

			index = await firstValueFrom(
				this.lookupService.getSearchIndexByEmailAddress$(emailAddress),
			);

			if (!index) {
				const alert = await this.alerts.create({
					header: 'Not Found',
					message: `No registration found with email address ${emailAddress}`,
					buttons: ['OK'],
				});

				await alert.present();
			}
		} catch (error: any) {
			const alert = await this.alerts.create({
				header: 'Error - could not find customer',
				message: `An error occurred: ${error.details ?? error.message}`,
				buttons: ['OK'],
			});
			await alert.present();
		} finally {
			if (await this.loading.getTop()) await this.loading.dismiss();
		}

		return index;
	}

	private async sendEmail(index: RegistrationSearchIndex): Promise<void> {
		try {
			const loading = await this.loading.create({
				message: 'Creating email...',
				translucent: true,
				backdropDismiss: false,
			});

			await loading.present();

			const result = await this.sendEmailFn(index.customerId);
			console.log(result);
		} catch (error: any) {
			const alert = await this.alerts.create({
				header: 'Error - could not send email',
				message: `An error occurred: ${error.details ?? error.message}`,
				buttons: ['OK'],
			});
			await alert.present();
			return;
		} finally {
			if (await this.loading.getTop()) await this.loading.dismiss();
		}

		const alert = await this.alerts.create({
			header: 'Email sent!',
			message: `Registration email sent to ${this.form.value}`,
			buttons: ['OK'],
		});

		await alert.present();
		await alert.onDidDismiss();
	}

	public reset(): void {
		this.form.reset();
	}
}
