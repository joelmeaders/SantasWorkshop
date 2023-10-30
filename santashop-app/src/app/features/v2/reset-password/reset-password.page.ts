import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '@santashop/core';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

@Component({
	selector: 'app-reset-password',
	templateUrl: './reset-password.page.html',
	styleUrls: ['./reset-password.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
	public readonly form: FormGroup = this.formBuilder.group({
		emailAddress: [
			undefined,
			Validators.compose([Validators.required, Validators.email]),
		],
	});

	// TODO: ReCaptchaV2.ReCaptcha namespace does not allow testing to work
	// even though @types/greptcha is installed. Try again later.
	@ViewChild('captchaRef') public captchaRef: any | null = null;

	private readonly resetEmailSent = new BehaviorSubject<boolean>(false);
	public readonly resetEmailSent$ = this.resetEmailSent
		.asObservable()
		.pipe(shareReplay(1));

	private readonly recaptchaValid = new BehaviorSubject<boolean>(false);
	public readonly recaptchaValid$ = this.recaptchaValid
		.asObservable()
		.pipe(shareReplay(1));

	constructor(
		private readonly formBuilder: FormBuilder,
		private readonly authService: AuthService,
		private readonly afFunctions: Functions,
		private readonly alertController: AlertController,
		private readonly translateService: TranslateService,
		private readonly analytics: Analytics,
	) {}

	public resetPage(): void {
		this.form.controls.emailAddress.setValue(undefined);
		this.form.markAsPristine();
		this.resetEmailSent.next(false);
		this.recaptchaValid.next(false);
		this.captchaRef?.reset();
	}

	public async onValidateRecaptcha($event: any): Promise<void> {
		if (!(await this.validateRecaptcha($event))) {
			this.recaptchaValid.next(false);
			await this.failedVerification();
			return;
		}

		logEvent(this.analytics, 'validated_recaptcha');
		this.recaptchaValid.next(true);
	}

	public async resetPassword(): Promise<void> {
		if (!this.recaptchaValid.getValue()) return;

		const email = this.form.get('emailAddress')?.value;

		logEvent(this.analytics, 'reset_password');

		await this.authService.resetPassword(email).then(() => {
			this.resetEmailSent.next(true);
		});
	}

	private async validateRecaptcha($event: any): Promise<boolean> {
		const status = await httpsCallable(
			this.afFunctions,
			'verifyRecaptcha2',
		)({ value: $event });
		return Promise.resolve((status.data as any).success);
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
