import { Injectable, inject } from '@angular/core';
import { CheckIn, COLLECTION_SCHEMA } from '@santashop/models';
import {
	AuthService,
	FireRepoLite,
	IFireRepoCollection,
} from '@santashop/core';
import { distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
import { AlertController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
	providedIn: 'root',
})
export class CheckinService {
	private readonly fireRepo = inject(FireRepoLite);
	private readonly authService = inject(AuthService);
	private readonly alertController = inject(AlertController);
	private readonly translate = inject(TranslateService);

	private readonly checkinCollection = (): IFireRepoCollection<CheckIn> =>
		this.fireRepo.collection<CheckIn>(COLLECTION_SCHEMA.checkins);

	public readonly hasCheckIn$ = this.authService.currentUser$.pipe(
		map((user) => user?.uid),
		distinctUntilChanged(),
		switchMap((uid) => uid ? this.checkinCollection().read(uid) : of(undefined)),
		distinctUntilChanged(),
		map((checkin) => !!checkin),
	);

	public readonly checkinAlertSubscription = this.hasCheckIn$
		.pipe(
			distinctUntilChanged(),
			filter((hasCheckIn) => !!hasCheckIn),
			switchMap(() => this.displayAlert()),
		)
		.subscribe();

	private async displayAlert(): Promise<void> {
		const alert = await this.alertController.create({
			header: this.translate.instant('CHECKIN.COMPLETE_TITLE'),
			subHeader: this.translate.instant('CHECKIN.COMPLETE_SUBTITLE'),
			message: this.translate.instant('CHECKIN.COMPLETE_MESSAGE'),
			backdropDismiss: false,
			buttons: [this.translate.instant('CHECKIN.OK')],
		});

		await alert.present();
		await alert.onDidDismiss();
		this.authService.logout(true);
	}
}
