import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular/standalone';
import { Registration } from '@santashop/models';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { HttpsCallableResult } from '@santashop/core';

@Injectable({
	providedIn: 'root',
})
export class CheckInService {
	private readonly checkInFn = (
		registration: Registration,
	): Promise<HttpsCallableResult<number>> =>
		httpsCallable<Registration, number>(
			this.functions,
			'checkIn',
		)(registration);

	private readonly checkInWithEditFn = (
		registration: Partial<Registration>,
	): Promise<HttpsCallableResult<number>> =>
		httpsCallable<Registration, number>(
			this.functions,
			'checkInWithEdit',
		)(registration);

	private readonly onSiteRegistrationFn = (
		registration: Registration,
	): Promise<HttpsCallableResult<number>> =>
		httpsCallable<Registration, number>(
			this.functions,
			'onSiteRegistration',
		)(registration);

	constructor(
		private readonly functions: Functions,
		private readonly loadingController: LoadingController,
	) {}

	public async checkIn(
		registration: Registration,
		isEdit = false,
	): Promise<number> {
		if (!registration?.uid) throw new Error('Invalid registration');

		const loading = await this.loadingController.create({
			message: 'Saving check-in...',
			translucent: true,
			backdropDismiss: false,
		});

		await loading.present();

		try {
			const partialRegistration = {
				uid: registration.uid,
				qrcode: registration.qrcode,
				zipCode: registration.zipCode,
				children: registration.children,
				hasCheckedIn: true,
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

	public async onSiteRegistration(
		registration: Registration,
	): Promise<number> {
		const loading = await this.loadingController.create({
			message: 'Saving registration...',
			translucent: true,
			backdropDismiss: false,
		});

		await loading.present();

		try {
			const response = await this.onSiteRegistrationFn(registration);
			return response.data;
		} finally {
			if (await this.loadingController.getTop())
				await this.loadingController.dismiss();
		}
	}
}
