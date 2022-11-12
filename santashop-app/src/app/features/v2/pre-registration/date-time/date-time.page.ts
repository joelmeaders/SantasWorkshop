import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { SkeletonStateService } from '@core/*';
import { AlertController } from '@ionic/angular';
import { DateTimeSlot } from '../../../../../../../santashop-models/src/public-api';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import {
	shareReplay,
	take,
	map,
	takeUntil,
	distinctUntilChanged,
} from 'rxjs/operators';
import { DateTimePageService } from './date-time.page.service';

@Component({
	selector: 'app-date-time',
	templateUrl: './date-time.page.html',
	styleUrls: ['./date-time.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [DateTimePageService],
})
export class DateTimePage implements OnDestroy {
	private readonly destroy$ = new Subject<void>();

	public readonly availableSlots$ = this.viewService.availableSlots$.pipe(
		takeUntil(this.destroy$),
		map((slots) => slots.filter((slot) => slot.enabled)),
		distinctUntilChanged(
			(prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
		),
		shareReplay(1)
	);

	public readonly availableDays$ = this.availableSlots$.pipe(
		takeUntil(this.destroy$),
		map((slots) =>
			slots.map((slot) => Date.parse(slot.dateTime.toDateString()))
		),
		map((dates) => [...new Set(dates)]),

		shareReplay(1)
	);

	public readonly availableSlotsByDay$ = (
		date: number
	): Observable<DateTimeSlot[]> =>
		this.availableSlots$.pipe(
			takeUntil(this.destroy$),
			map((slots) =>
				slots.filter(
					(slot) => Date.parse(slot.dateTime.toDateString()) === date
				)
			),
			shareReplay(1)
		);

	public readonly chosenSlot$ = this.viewService.registrationSlot$.pipe(
		takeUntil(this.destroy$),
		shareReplay(1)
	);

	constructor(
		private readonly viewService: DateTimePageService,
		private readonly alertController: AlertController,
		private readonly translateService: TranslateService,
		private readonly analytics: Analytics,
		public readonly skeletonState: SkeletonStateService
	) {}

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public ionViewDidLeave(): void {
		this.skeletonState.removeStatesByGroup('dateTimePage');
	}

	public async selectDateTime(slot?: DateTimeSlot): Promise<void> {
		const hasSlot = await this.alreadyChoseSlot();
		let shouldChange = false;

		if (hasSlot) shouldChange = await this.confirmChangeDate();

		if (shouldChange) logEvent(this.analytics, 'cancelled_datetime');

		if (!hasSlot || shouldChange) {
			logEvent(this.analytics, 'chose_datetime');
			await this.viewService.updateRegistration(slot);
		}
	}

	public spotsRemaining(slot: DateTimeSlot): string {
		const slots = slot.maxSlots - (slot.slotsReserved ?? 0);

		if (!slot.enabled || slots <= 0) return 'Unavailable';

		return slots === 1 ? `${slots} spot` : `${slots} spots`;
	}

	private alreadyChoseSlot(): Promise<boolean> {
		const source = this.chosenSlot$.pipe(
			take(1),
			map((slot) => !!slot)
		);
		return firstValueFrom(source);
	}

	private async confirmChangeDate(): Promise<boolean> {
		const alert = await this.alertController.create({
			// TODO: This stuff
			header: this.translateService.instant('Confirm Changes'),
			subHeader: this.translateService.instant(
				'Are you sure you want to do this?'
			),
			message: this.translateService.instant(
				'The slot you already have may no longer be available if you continue.'
			),
			buttons: [
				{
					text: 'Go Back',
					role: 'cancel',
				},
				{
					text: 'Continue',
				},
			],
		});

		await alert.present();

		return alert.onDidDismiss().then((e) => e.role !== 'cancel');
	}
}
