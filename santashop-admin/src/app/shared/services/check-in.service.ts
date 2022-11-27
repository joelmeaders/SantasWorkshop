import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular';
import { CheckIn, Registration } from '@models/*';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable()
export class CheckInService {
	constructor(
		private readonly functions: Functions,
		private readonly loadingController: LoadingController
	) {}

	public async checkIn(
		registration: Registration,
		isEdit = false
	): Promise<CheckIn> {
		if (!registration?.uid) throw new Error('Invalid registration');

		const loading = await this.loadingController.create({
			message: 'Saving check-in...',
			translucent: true,
			backdropDismiss: true,
		});

		await loading.present();

		let result: CheckIn;

		try {
			console.log('isedit', isEdit);
			if (isEdit) {
				const partialRegistration = {
					uid: registration.uid,
					qrcode: registration.qrcode,
					zipCode: registration.zipCode,
					children: registration.children,
				} as Partial<Registration>;

				const response = await httpsCallable<
					Partial<Registration>,
					CheckIn
				>(
					this.functions,
					'checkInWithEdit'
				)(partialRegistration);
				result = response.data;
			} else {
				const response = await httpsCallable<Registration, CheckIn>(
					this.functions,
					'checkIn'
				)(registration);
				result = response.data;
				console.log(response);
			}
		} catch (error) {
			await this.loadingController.dismiss();
			throw error;
		} finally {
			await this.loadingController.dismiss();
		}

		return result;
	}
}
