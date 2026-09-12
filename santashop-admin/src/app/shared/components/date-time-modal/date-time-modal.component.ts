import { AdminLanguageService } from '../../preferences/admin-language.service';
import { AdminTimeSlotPipe } from '../../preferences/admin-time-slot.pipe';
import { createAdminAlert } from '../../preferences/admin-overlays';
import { AdminDatePipe } from '../../preferences/admin-date.pipe';
import { AdminTextPipe } from '../../preferences/admin-text.pipe';
import {
	ChangeDetectionStrategy,
	Component,
	Input,
	computed,
	inject,
	signal,
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
import { Observable, map, of, switchMap, distinctUntilChanged } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import type { DateTimeSlot } from '@santashop/models';
import { createZonedDate, getZonedDateKey } from '@santashop/models';

@Component({
	selector: 'admin-date-time-modal',
	templateUrl: './date-time-modal.component.html',
	styleUrls: ['./date-time-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AdminTimeSlotPipe,
		AdminTextPipe,
		AdminDatePipe,
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
export class DateTimeModalComponent {
	private readonly language = inject(AdminLanguageService);
	private readonly modalController = inject(ModalController);
	private readonly alertController = inject(AlertController);
	private readonly slotsInput = signal<Observable<DateTimeSlot[]>>(of([]));

	@Input() public currentSlot?: DateTimeSlot;
	@Input({ required: true })
	public set slots$(slots: Observable<DateTimeSlot[]>) {
		this.slotsInput.set(slots);
	}

	public readonly selectedSlot = signal<DateTimeSlot | undefined>(undefined);
	private readonly slotsStream$ = toObservable(this.slotsInput).pipe(
		switchMap((slots) => slots),
		map((slots: DateTimeSlot[]) =>
			slots.filter(
				(slot) =>
					slot.enabled && (slot.slotsReserved ?? 0) < slot.maxSlots,
			),
		),
		distinctUntilChanged(
			(prev, curr) => JSON.stringify(prev) === JSON.stringify(curr),
		),
	);
	public readonly availableSlots = toSignal(this.slotsStream$, {
		initialValue: [],
	});
	public readonly availableDays = computed(() =>
		this.availableSlots().reduce<number[]>((days, slot) => {
			const day = createZonedDate(
				getZonedDateKey(slot.dateTime),
				0,
			).getTime();
			if (!days.includes(day)) days.push(day);
			return days;
		}, []),
	);
	public readonly availableSlotsByDay = computed(() => {
		const slotsByDay = new Map<number, DateTimeSlot[]>();
		for (const slot of this.availableSlots()) {
			const day = createZonedDate(
				getZonedDateKey(slot.dateTime),
				0,
			).getTime();
			const slots = slotsByDay.get(day) ?? [];
			slots.push(slot);
			slotsByDay.set(day, slots);
		}
		return slotsByDay;
	});

	public async selectDateTime(slot?: DateTimeSlot): Promise<void> {
		const hasSlot = !!this.currentSlot;
		let shouldChange = false;

		if (hasSlot && slot) {
			shouldChange = await this.confirmChangeDate();
		}

		if (!hasSlot || shouldChange) {
			this.selectedSlot.set(slot);
			await this.dismiss();
		}
	}

	public spotsRemaining(slot: DateTimeSlot): string {
		const spots = slot.maxSlots - (slot.slotsReserved ?? 0);

		if (!slot.enabled || spots <= 0)
			return this.language.text('Unavailable');

		return this.language.text(
			spots === 1 ? '{{count}} spot' : '{{count}} spots',
			{ count: spots },
		);
	}

	public async dismiss(): Promise<void> {
		const slot = this.selectedSlot();
		await this.modalController.dismiss(slot);
	}

	private async confirmChangeDate(): Promise<boolean> {
		const alert = await createAdminAlert(this.alertController, () => ({
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
		}));

		await alert.present();

		return alert.onDidDismiss().then((e) => e.role !== 'cancel');
	}
}
