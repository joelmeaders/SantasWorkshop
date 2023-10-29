import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { IError } from '@models/*';
import { AnalyticsWrapper } from './_analytics-wrapper';

@Injectable({
	providedIn: 'root',
})
export class ErrorHandlerService {
	constructor(
		private readonly analyticsWrapper: AnalyticsWrapper,
		private readonly alertController: AlertController
	) {}

	public async handleError(
		error: IError,
		title: string = 'Error Encountered',
		showAlert: boolean = true
	): Promise<any> {
		const alert = await this.alertController.create({
			header: title,
			subHeader: `Code: ${error.code}`,
			message: error.details,
			buttons: ['Ok'],
		});

		if (showAlert) await alert.present();

		try {
			this.analyticsWrapper.logErrorEvent(error.code, error.message);
		} catch {
			// Do nothing
		}

		if (showAlert) return alert.onDidDismiss();
	}

	public async completeRegistrationException(error: IError): Promise<void> {
		const alert = await this.alertController.create({
			header: 'Please try submitting again.',
			subHeader: 'We ran into an issue but it might be resolved if you retry.',
			message: 'If this continues to happen please contact us on Facebook',
			buttons: ['Ok'],
		});

		await alert.present();

		try {
			this.analyticsWrapper.logErrorEvent(error.code, error.message);
		} catch {
			// Do nothing
		}
	}
}
