import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	inject,
	input,
} from '@angular/core';
import {
	AlertController,
	ModalController,
	IonHeader,
	IonToolbar,
	IonTitle,
	IonButton,
	IonContent,
	IonList,
	IonListHeader,
	IonAccordionGroup,
	IonAccordion,
	IonItem,
	IonLabel,
	IonText,
	IonCard,
	IonCardHeader,
	IonCardContent,
	IonCardTitle,
	IonNote,
} from '@ionic/angular/standalone';
import {
	BehaviorSubject,
	Observable,
	Subject,
	map,
	shareReplay,
	takeUntil,
	distinctUntilChanged,
} from 'rxjs';
import { AsyncPipe, DatePipe } from '@angular/common';
import type { DateTimeSlot } from '@santashop/models';
import { TimeSlotPipe, CoreModule } from '@santashop/core';
import { DateTimeModalService } from './date-time-modal.service';

@Component({
	selector: 'admin-date-time-modal',
	templateUrl: './date-time-modal.component.html',
	styleUrls: ['./date-time-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [DateTimeModalService],
	imports: [
		AsyncPipe,
		DatePipe,
		TimeSlotPipe,
		CoreModule,
		IonHeader,
		IonToolbar,
		IonTitle,
		IonButton,
		IonContent,
		IonList,
		IonListHeader,
		IonAccordionGroup,
		IonAccordion,
		IonItem,
		IonLabel,
		IonText,
		IonCard,
		IonCardHeader,
		IonCardContent,
		IonCardTitle,
		IonNote,
	],
})
export class DateTimeModalComponent implements OnDestroy {
	private readonly modalController = inject(ModalController);
	private readonly alertController = inject(AlertController);
	private readonly dateTimeService = inject(DateTimeModalService);

	public readonly currentSlot = input<DateTimeSlot>();

	private readonly destroy$ = new Subject<void>();

	private readonly selectedSlot = new BehaviorSubject<
		DateTimeSlot | undefined
	>(undefined);
	public readonly selectedSlot$ = this.selectedSlot.asObservable();

	public readonly availableSlots$ = this.dateTimeService.availableSlots$.pipe(
		takeUntil(this.destroy$),
		map((slots: DateTimeSlot[]) => slots.filter((slot) => slot.enabled)),
		distinctUntilChanged(
			(prev, curr) => JSON.stringify(prev) === JSON.stringify(curr),
		),
		shareReplay(1),
	);

	public readonly availableDays$ = this.availableSlots$.pipe(
		takeUntil(this.destroy$),
		map((slots: DateTimeSlot[]) =>
			slots.map((slot) => Date.parse(slot.dateTime.toDateString())),
		),
		map((dates: number[]) => [...new Set(dates)]),
		shareReplay(1),
	);

	public readonly availableSlotsByDay$ = (
		date: number,
	): Observable<DateTimeSlot[]> =>
		this.availableSlots$.pipe(
			takeUntil(this.destroy$),
			map((slots: DateTimeSlot[]) =>
				slots.filter(
					(slot) => Date.parse(slot.dateTime.toDateString()) === date,
				),
			),
			shareReplay(1),
		);

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public async selectDateTime(slot?: DateTimeSlot): Promise<void> {
		const hasSlot = !!this.currentSlot();
		let shouldChange = false;

		if (hasSlot && slot) {
			shouldChange = await this.confirmChangeDate();
		}

		if (!hasSlot || shouldChange) {
			this.selectedSlot.next(slot);
			await this.dismiss();
		}
	}

	public spotsRemaining(slot: DateTimeSlot): string {
		const spots = slot.maxSlots - (slot.slotsReserved ?? 0);

		if (!slot.enabled || spots <= 0) return 'Unavailable';

		return spots === 1 ? `${spots} spot` : `${spots} spots`;
	}

	public async dismiss(): Promise<void> {
		const slot = this.selectedSlot.getValue();
		await this.modalController.dismiss(slot);
	}

	private async confirmChangeDate(): Promise<boolean> {
		const alert = await this.alertController.create({
			header: 'Confirm Changes',
			subHeader: 'Are you sure you want to change the date/time?',
			message:
				'The slot this customer already has may no longer be available if you continue.',
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
