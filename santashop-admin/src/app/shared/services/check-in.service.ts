import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular';
import { Registration } from '@models/*';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { HttpsCallableResult } from '../../../../../santashop-core/src';

@Injectable()
export class CheckInService {
	private readonly checkInFn = (
		registration: Registration
	): Promise<HttpsCallableResult<number>> =>
		httpsCallable<Registration, number>(
			this.functions,
			'checkIn'
		)(registration);

	private readonly checkInWithEditFn = (
		registration: Partial<Registration>
	): Promise<HttpsCallableResult<number>> =>
		httpsCallable<Registration, number>(
			this.functions,
			'checkInWithEdit'
		)(registration);

	constructor(
		private readonly functions: Functions,
		private readonly loadingController: LoadingController
	) {}

	public async checkIn(
		registration: Registration,
		isEdit = false
	): Promise<number> {
		if (!registration?.uid) throw new Error('Invalid registration');

		const loading = await this.loadingController.create({
			message: 'Saving check-in...',
			translucent: true,
			backdropDismiss: true,
		});

		await loading.present();

		try {
			const partialRegistration = {
				uid: registration.uid,
				qrcode: registration.qrcode,
				zipCode: registration.zipCode,
				children: registration.children,
			} as Partial<Registration>;

			const response = isEdit
				? await this.checkInWithEditFn(partialRegistration)
				: await this.checkInFn(partialRegistration);

			return response.data;
		} finally {
			if (await this.loadingController.getTop())
				await this.loadingController.dismiss();
		}
	}
}
