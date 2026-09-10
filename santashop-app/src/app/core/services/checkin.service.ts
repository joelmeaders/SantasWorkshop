import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CheckIn, COLLECTION_SCHEMA } from '@santashop/models';
import {
	AuthService,
	FireRepoLite,
	IFireRepoCollection,
} from '@santashop/core';
import {
	catchError,
	defer,
	distinctUntilChanged,
	filter,
	map,
	of,
	startWith,
	shareReplay,
	tap,
	switchMap,
} from 'rxjs';
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
	private readonly destroyRef = inject(DestroyRef);
	private identityVersion = 0;
	private activeAlert?: Awaited<ReturnType<AlertController['create']>>;

	private readonly checkinCollection = (): IFireRepoCollection<CheckIn> =>
		this.fireRepo.collection<CheckIn>(COLLECTION_SCHEMA.checkins);

	private readonly identity$ = this.authService.currentUser$.pipe(
		map((user) => user?.uid),
		distinctUntilChanged(),
		tap(() => {
			this.identityVersion++;
			void this.activeAlert?.dismiss();
			this.activeAlert = undefined;
		}),
		takeUntilDestroyed(this.destroyRef),
		shareReplay(1),
	);
	public readonly hasCheckIn$ = this.identity$.pipe(
		switchMap((uid) =>
			uid
				? defer(() => this.checkinCollection().read(uid)).pipe(
						catchError(() => of(undefined)),
						startWith(undefined),
					)
				: of(undefined),
		),
		distinctUntilChanged(),
		map((checkin) => !!checkin),
		takeUntilDestroyed(this.destroyRef),
		shareReplay(1),
	);

	public readonly checkinAlertSubscription = this.hasCheckIn$
		.pipe(
			distinctUntilChanged(),
			filter((hasCheckIn) => !!hasCheckIn),
			switchMap(() => this.displayAlert()),
		)
		.subscribe();

	private async displayAlert(): Promise<void> {
		const version = this.identityVersion;
		const alert = await this.alertController.create({
			header: this.translate.instant('CHECKIN.COMPLETE_TITLE'),
			subHeader: this.translate.instant('CHECKIN.COMPLETE_SUBTITLE'),
			message: this.translate.instant('CHECKIN.COMPLETE_MESSAGE'),
			backdropDismiss: false,
			buttons: [this.translate.instant('CHECKIN.OK')],
		});

		if (version !== this.identityVersion || this.destroyRef.destroyed)
			return;
		this.activeAlert = alert;
		await alert.present();
		if (version !== this.identityVersion) {
			await alert.dismiss();
			return;
		}
		await alert.onDidDismiss();
		if (version === this.identityVersion && !this.destroyRef.destroyed)
			await this.authService.logout(true);
	}
}
