import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { IError } from '@santashop/models';
import { AnalyticsWrapper } from './_analytics-wrapper';

@Injectable({
	providedIn: 'root',
})
export class ErrorHandlerService {
	private readonly analyticsWrapper = inject(AnalyticsWrapper);
	private readonly alertController = inject(AlertController);

	public async handleError(
		error: IError,
		title = 'Error Encountered',
		showAlert = true,
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
			subHeader:
				'We ran into an issue but it might be resolved if you retry.',
			message:
				'If this continues to happen please contact us on Facebook',
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
