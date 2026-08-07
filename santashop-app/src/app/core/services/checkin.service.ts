import { Injectable, inject } from '@angular/core';
import { CheckIn, COLLECTION_SCHEMA } from '@santashop/models';
import {
	AuthService,
	filterNil,
	FireRepoLite,
	IFireRepoCollection,
} from '@santashop/core';
import { distinctUntilChanged, filter, map, switchMap } from 'rxjs';
import { AlertController } from '@ionic/angular';

@Injectable({
	providedIn: 'root',
})
export class CheckinService {
	private readonly fireRepo = inject(FireRepoLite);
	private readonly authService = inject(AuthService);
	private readonly alertController = inject(AlertController);

	private readonly checkinCollection = (): IFireRepoCollection<CheckIn> =>
		this.fireRepo.collection<CheckIn>(COLLECTION_SCHEMA.checkins);

	public readonly hasCheckIn$ = this.authService.uid$.pipe(
		filterNil(),
		switchMap((uid) => this.checkinCollection().read(uid)),
		distinctUntilChanged(),
		map((checkin) => !!checkin),
	);

	public readonly checkinAlertSubscription = this.hasCheckIn$
		.pipe(
			filter((hasCheckIn) => !!hasCheckIn),
			distinctUntilChanged(),
			switchMap(() => this.displayAlert()),
		)
		.subscribe();

	private async displayAlert(): Promise<void> {
		const alert = await this.alertController.create({
			header: 'Merry Christmas!',
			subHeader: 'We hope your shopping experience was wonderful',
			message:
				'Your registration and checkin was confirmed so this app will be disabled until next year.',
			backdropDismiss: false,
			buttons: ['Ok'],
		});

		await alert.present();
		await alert.onDidDismiss();
		this.authService.logout(true);
	}
}
