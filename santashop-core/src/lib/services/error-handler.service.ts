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
		showAlert: boolean = true
	): Promise<any> {
		const alert = await this.alertController.create({
			header: 'Error Encountered',
			subHeader: `Code: ${error.code}`,
			message: error.details,
			buttons: ['Ok'],
		});

		if (showAlert) await alert.present();

		try {
			this.analyticsWrapper.logEvent(error.code, error.message);
		} catch {
			// Do nothing
		}

		if (showAlert) return alert.onDidDismiss();
	}
}
