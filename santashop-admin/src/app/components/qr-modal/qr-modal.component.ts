import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import {
	CheckIn,
	IError,
} from '../../../../../santashop-models/src/public-api';
import { BehaviorSubject, from, Subject } from 'rxjs';
import {
	distinctUntilChanged,
	filter,
	mergeMap,
	publishReplay,
	refCount,
	take,
	takeUntil,
	tap,
} from 'rxjs/operators';
import { CheckInHelpers } from '../../helpers/checkin-helpers';
import { CheckInService } from '../../services/check-in.service';
import { Timestamp } from '@firebase/firestore';
import { RegistrationContextService } from '../../services/registration-context.service';
import { ErrorHandlerService } from '@core/*';

@Component({
	selector: 'app-qr-modal',
	templateUrl: './qr-modal.component.html',
	styleUrls: ['./qr-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrModalComponent implements OnDestroy {
	private readonly $destroy = new Subject<void>();
	public readonly $loading = new BehaviorSubject<boolean>(true);

	public friendlyTimestamp = CheckInHelpers.friendlyTimestamp;
	public cardColor = CheckInHelpers.childColor;

	public readonly $registration = this.registrationContext.registration$.pipe(
		takeUntil(this.$destroy),
		publishReplay(1),
		refCount()
	);

	public readonly $existingCheckin = this.registrationContext.checkin$.pipe(
		takeUntil(this.$destroy),
		tap(() => this.$loading.next(false)),
		publishReplay(1),
		refCount()
	);

	private readonly existingAlertSubcription = this.$existingCheckin
		.pipe(
			takeUntil(this.$destroy),
			distinctUntilChanged(),
			filter((response) => !!response?.customerId),
			mergeMap((response) => from(this.alreadyCheckedIn(response)))
		)
		.subscribe();

	constructor(
		private readonly registrationContext: RegistrationContextService,
		private readonly modalController: ModalController,
		private readonly alertController: AlertController,
		private readonly checkInService: CheckInService,
		private readonly errorHandler: ErrorHandlerService
	) {}

	ngOnDestroy() {
		this.existingAlertSubcription.unsubscribe();
		this.$destroy.next();
		this.$destroy.complete();
	}

	public async editRegistration() {
		await this.modalController.dismiss(undefined, 'edit');
	}

	public async checkIn() {
		const alert = await this.confirmCheckInAlert();

		await alert.present();
		const response = await alert.onDidDismiss().then((res) => res.role);

		if (response !== 'confirm') {
			return;
		}

		const registration = await this.$registration.pipe(take(1)).toPromise();

		if (!registration) {
			const error: IError = {
				code: 'no-reg',
				message: 'No registration is loaded',
			};
			await this.errorHandler.handleError(error);
			return;
		}

		try {
			this.$destroy.next();
			this.registrationContext.reset();
			await this.checkInService.checkIn(registration, false);
		} catch (error) {
			await this.errorHandler.handleError(error as IError);
		}

		await this.modalController.dismiss(undefined, 'checkin');
	}

	private async confirmCheckInAlert() {
		return this.alertController.create({
			header: 'Confirm Action',
			subHeader: 'A check-in cannot be undone',
			message:
				'Are you sure there are no changes? Once checked in, the customer code is no longer valid',
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel',
				},
				{
					text: 'Confirm',
					role: 'confirm',
				},
			],
		});
	}

	private async alreadyCheckedIn(checkin?: CheckIn) {
		if (!checkin) return;

		const alert = await this.alertController.create({
			header: 'Existing Check-In',
			subHeader: CheckInHelpers.friendlyTimestamp(
				(<any>checkin!.checkInDateTime) as Timestamp
			),
			message:
				'This registration code was already used on the date/time specified. Unable to continue.',
			buttons: [
				{
					text: 'Ok',
				},
			],
		});

		await alert.present();

		return alert.onDidDismiss();
	}

	public async cancel() {
		await this.modalController.dismiss(undefined, 'cancel');
	}
}
