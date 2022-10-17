import { ErrorHandler, Injectable } from '@angular/core';
import { AlertController, LoadingController } from '@ionic/angular';
import {
	AgeGroup,
	COLLECTION_SCHEMA,
	CheckIn,
	CheckInStats,
	Registration,
	ToyType,
} from '../../../../santashop-models/src/public-api';
import { DocumentReference, FireRepoLite } from 'santashop-core/src/public-api';
import { firstValueFrom } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class CheckInService {
	constructor(
		private readonly repoService: FireRepoLite,
		private readonly alertController: AlertController,
		private readonly loadingController: LoadingController,
		private readonly errorHandler: ErrorHandler
	) {}

	public async checkIn(registration: Registration, isEdit = false) {
		const loading = await this.loadingController.create({
			message: 'Saving check-in...',
			translucent: true,
			backdropDismiss: true,
		});

		await loading.present();

		let alert: HTMLIonAlertElement | undefined;
		let result: DocumentReference<CheckIn> | undefined;

		try {
			const checkin = this.convertRegistrationToCheckIn(
				registration,
				isEdit
			);

			const saveMethod = checkin.stats?.preregistered
				? this.repoService
						.collection<CheckIn>(COLLECTION_SCHEMA.checkins)
						.addById(checkin.customerId!, checkin)
				: this.repoService
						.collection<CheckIn>(COLLECTION_SCHEMA.checkins)
						.add(checkin);

			result = await firstValueFrom(saveMethod);

			alert = await this.alertController.create({
				header: 'Check-In Complete',
				buttons: [
					{
						text: 'Ok',
					},
				],
			});

			await alert.present();
		} catch (error) {
			await this.loadingController.dismiss();
			this.errorHandler.handleError(error);
		} finally {
			await this.loadingController.dismiss();
		}

		return Promise.resolve(result);
	}

	private convertRegistrationToCheckIn(
		registration: Registration,
		isEdit: boolean
	): CheckIn {
		const checkin: CheckIn = {
			checkInDateTime: new Date(),
			inStats: false,
		};

		if (registration.uid) checkin.customerId = registration.uid;

		if (registration.qrcode) checkin.registrationCode = registration.qrcode;

		checkin.stats = this.registrationStats(registration, isEdit);

		return checkin;
	}

	private registrationStats(
		registration: Registration,
		isEdit: boolean
	): CheckInStats {
		const stats: CheckInStats = {
			preregistered:
				(!!registration.qrcode && !!registration.uid) || false,
			children: registration.children?.length || 0,
			ageGroup02: registration.children!.filter(
				(c) => c.ageGroup === AgeGroup.age02
			).length,
			ageGroup35: registration.children!.filter(
				(c) => c.ageGroup === AgeGroup.age35
			).length,
			ageGroup68: registration.children!.filter(
				(c) => c.ageGroup === AgeGroup.age68
			).length,
			ageGroup911: registration.children!.filter(
				(c) => c.ageGroup === AgeGroup.age911
			).length,
			toyTypeInfant: registration.children!.filter(
				(c) => c.toyType === ToyType.infant
			).length,
			toyTypeBoy: registration.children!.filter(
				(c) => c.toyType === ToyType.boy
			).length,
			toyTypeGirl: registration.children!.filter(
				(c) => c.toyType === ToyType.girl
			).length,
			modifiedAtCheckIn: isEdit,
			zipCode: registration.zipCode!,
		};
		return stats;
	}
}
