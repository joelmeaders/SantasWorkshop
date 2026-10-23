import { AdminLanguageService } from '../../../../shared/preferences/admin-language.service';
import { createAdminAlert } from '../../../../shared/preferences/admin-overlays';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
	UntypedFormGroup,
	UntypedFormControl,
	Validators,
	ReactiveFormsModule,
} from '@angular/forms';
import {
	FunctionsWrapper,
	HttpsCallableResult,
} from '@santashop/core/admin/firestore';
import {
	AlertController,
	LoadingController,
	IonContent,
	IonCardHeader,
	IonList,
	IonItem,
	IonInput,
	IonButton,
	IonIcon,
	IonLabel,
	IonCheckbox,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { LookupService } from '../../../../shared/services/lookup.service';
import {
	RegistrationSearchIndex,
	ResendRegistrationEmailRequest,
} from '@santashop/models';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { addIcons } from 'ionicons';
import { mailOutline } from 'ionicons/icons';

@Component({
	selector: 'admin-resend-email',
	templateUrl: './resend-email.page.html',
	styleUrls: ['./resend-email.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AdminTextPipe,
		HeaderComponent,
		ReactiveFormsModule,
		IonContent,
		IonCardHeader,
		IonList,
		IonItem,
		IonInput,
		IonButton,
		IonIcon,
		IonLabel,
		IonCheckbox,
	],
})
export class ResendEmailPage {
	public readonly language = inject(AdminLanguageService);
	private readonly lookupService = inject(LookupService);
	private readonly functions = inject(FunctionsWrapper);
	private readonly alerts = inject(AlertController);
	private readonly loading = inject(LoadingController);

	public readonly form = new UntypedFormGroup({
		recoverQueueId: new UntypedFormControl(''),
		acknowledgeUncertainDelivery: new UntypedFormControl(false),
		emailAddress: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: [Validators.required, Validators.email],
		}),
	});

	private readonly sendEmailFn = (
		customerId: string,
	): Promise<HttpsCallableResult<boolean>> =>
		this.functions.callableWrapper<ResendRegistrationEmailRequest, boolean>(
			'callableResendRegistrationEmail',
		)({
			customerId,
			...(this.form.controls['recoverQueueId'].value?.trim()
				? {
						recoverQueueId:
							this.form.controls['recoverQueueId'].value.trim(),
						acknowledgeUncertainDelivery:
							this.form.controls['acknowledgeUncertainDelivery']
								.value === true,
					}
				: {}),
		});

	constructor() {
		addIcons({ mailOutline });
	}

	public async searchAndSend(): Promise<void> {
		if (this.form.invalid) return;
		const email = this.form.controls['emailAddress'].value.toLowerCase();

		const index = await this.searchCustomer(email);
		if (!index) return;

		if (await this.sendEmail(index)) this.form.reset();
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
				const alert = await createAdminAlert(this.alerts, () => ({
					header: 'Not Found',
					message: this.language.text(
						'No registration found with email address {{v0}}',
						{ v0: emailAddress },
					),
					buttons: ['OK'],
				}));

				await alert.present();
			}
		} catch (error: unknown) {
			const err = error as { details?: string; message?: string };
			const alert = await createAdminAlert(this.alerts, () => ({
				header: 'Error - could not find customer',
				message: this.language.text('An error occurred: {{v0}}', {
					v0: err.details ?? err.message,
				}),
				buttons: ['OK'],
			}));
			await alert.present();
		} finally {
			if (await this.loading.getTop()) await this.loading.dismiss();
		}

		return index;
	}

	private async sendEmail(index: RegistrationSearchIndex): Promise<boolean> {
		try {
			const loading = await this.loading.create({
				message: 'Creating email...',
				translucent: true,
				backdropDismiss: false,
			});

			await loading.present();

			await this.sendEmailFn(index.customerId);
		} catch (error: unknown) {
			const err = error as { details?: string; message?: string };
			const alert = await createAdminAlert(this.alerts, () => ({
				header: 'Error - could not send email',
				message: this.language.text('An error occurred: {{v0}}', {
					v0: err.details ?? err.message,
				}),
				buttons: ['OK'],
			}));
			await alert.present();
			return false;
		} finally {
			if (await this.loading.getTop()) await this.loading.dismiss();
		}

		const alert = await createAdminAlert(this.alerts, () => ({
			header: 'Email queued',
			message: this.language.text(
				'Registration email queued for {{v0}}.',
				{
					v0: index.emailAddress,
				},
			),
			buttons: ['OK'],
		}));

		await alert.present();
		await alert.onDidDismiss();
		return true;
	}

	public reset(): void {
		this.form.reset();
	}
}
