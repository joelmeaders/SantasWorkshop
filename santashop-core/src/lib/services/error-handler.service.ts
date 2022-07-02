import { Injectable } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { AlertController } from '@ionic/angular';
import { IError } from '@models/*';

@Injectable({
	providedIn: 'root',
})
export class ErrorHandlerService {
	constructor(
		private readonly alertController: AlertController,
		private readonly analytics: Analytics
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
			await logEvent(this.analytics, error.code, {
				message: error.message,
			});
		} catch {
			// Do nothing
		}

		if (showAlert) return alert.onDidDismiss();
	}
}
