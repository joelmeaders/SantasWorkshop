import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { Router } from '@angular/router';
import { ErrorHandlerService } from '@core/*';
import { AlertController, LoadingController } from '@ionic/angular';
import { IError } from '../../../../../../../santashop-models/src/public-api';
import { TranslateService } from '@ngx-translate/core';
import { PreRegistrationService } from '../../../../core';

@Component({
	selector: 'app-confirmation',
	templateUrl: './confirmation.page.html',
	styleUrls: ['./confirmation.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationPage {
	public readonly isRegistrationComplete$ =
		this.viewService.registrationComplete$;

	constructor(
		public readonly viewService: PreRegistrationService,
		private readonly loadingController: LoadingController,
		private readonly alertController: AlertController,
		private readonly router: Router,
		private readonly errorHandler: ErrorHandlerService,
		private readonly translateService: TranslateService,
		private readonly analytics: Analytics
	) {}

	public async undoRegistration(): Promise<void> {
		const alert = await this.alertController.create({
			header: this.translateService.instant('CONFIRMATION.ARE_YOU_SURE'),
			message: this.translateService.instant(
				'CONFIRMATION.CONFIRM_CHANGE_MSG'
			),
			buttons: [
				{
					text: this.translateService.instant('COMMON.GO_BACK'),
					role: 'cancel',
					cssClass: 'confirm-delete-button',
				},
				{
					text: this.translateService.instant('COMMON.CONFIRM'),
					role: 'confirm',
				},
			],
		});

		await alert.present();
		const shouldContinue = await alert.onDidDismiss();

		if (shouldContinue.role !== 'confirm') return;

		const loader = await this.loadingController.create({
			message: 'Deleting registration...',
		});

		await loader.present();

		try {
			logEvent(this.analytics, 'delete_registration');
			await this.viewService.undoRegistration();
		} catch (error) {
			await this.errorHandler.handleError(error as IError);
		} finally {
			await loader.dismiss();
			this.router.navigate(['/pre-registration/overview']);
		}
	}
}
