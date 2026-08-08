import { Injectable, inject } from '@angular/core';
import { LoadingController } from '@ionic/angular';
import {
	type CheckInRequest,
	Registration,
	type ScanInputMethod,
} from '@santashop/models';
import { FunctionsWrapper, HttpsCallableResult } from '@santashop/core';

@Injectable({
	providedIn: 'root',
})
export class CheckInService {
	private readonly functions = inject(FunctionsWrapper);
	private readonly loadingController = inject(LoadingController);

	private readonly checkInFn = (
		request: CheckInRequest,
	): Promise<HttpsCallableResult<number>> =>
		this.functions.callableWrapper<CheckInRequest, number>('checkIn')(
			request,
		);

	private readonly checkInWithEditFn = (
		request: CheckInRequest,
	): Promise<HttpsCallableResult<number>> =>
		this.functions.callableWrapper<CheckInRequest, number>(
			'checkInWithEdit',
		)(request);

	private readonly onSiteRegistrationFn = (
		registration: Registration,
	): Promise<HttpsCallableResult<number>> =>
		this.functions.callableWrapper<Registration, number>(
			'onSiteRegistration',
		)(registration);

	public async checkIn(
		registration: Registration,
		isEdit = false,
		inputMethod: ScanInputMethod = 'camera',
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

			const request: CheckInRequest = {
				registration: partialRegistration,
				inputMethod,
			};
			const response = isEdit
				? await this.checkInWithEditFn(request)
				: await this.checkInFn(request);

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
