import {
	ChangeDetectionStrategy,
	Component,
	Input,
	computed,
	inject,
	signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
	ModalController,
	IonHeader,
	IonToolbar,
	IonTitle,
	IonButtons,
	IonButton,
	IonContent,
	IonList,
	IonListHeader,
	IonItem,
	IonLabel,
	IonText,
	IonNote,
	IonAccordionGroup,
	IonAccordion,
	IonCard,
	IonCardHeader,
	IonCardContent,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import type { DateTimeSlot } from '@santashop/models';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { TimeSlotPipe, timestampToDate } from '@santashop/core';
import { LocalizedDatePipe } from '../../../../shared/pipes/localized-date.pipe';

const EVENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
	day: '2-digit',
	month: '2-digit',
	timeZone: 'America/Denver',
	year: 'numeric',
});

const toEventDayKey = (date: Date): number => {
	const parts = Object.fromEntries(
		EVENT_DATE_FORMATTER.formatToParts(date).map(({ type, value }) => [
			type,
			value,
		]),
	);

	// Noon UTC stays on the same calendar date when formatted in Denver time.
	return Date.UTC(
		Number(parts['year']),
		Number(parts['month']) - 1,
		Number(parts['day']),
		12,
	);
};

@Component({
	selector: 'app-change-datetime-modal',
	templateUrl: './change-datetime-modal.component.html',
	styleUrls: ['./change-datetime-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		IonHeader,
		IonToolbar,
		IonTitle,
		IonButtons,
		IonButton,
		IonContent,
		IonList,
		IonListHeader,
		IonItem,
		IonLabel,
		IonText,
		IonNote,
		IonAccordionGroup,
		IonAccordion,
		IonCard,
		IonCardHeader,
		IonCardContent,
		LocalizedDatePipe,
		TranslateModule,
		TimeSlotPipe,
	],
})
export class ChangeDatetimeModalComponent {
	private readonly modalController = inject(ModalController);
	private readonly currentSlotInput = signal<DateTimeSlot | undefined>(
		undefined,
	);
	public readonly currentSlotValue = computed(() => {
		const value = this.currentSlotInput();
		return value
			? { ...value, dateTime: timestampToDate(value.dateTime) }
			: undefined;
	});
	@Input()
	public set currentSlot(value: DateTimeSlot) {
		this.currentSlotInput.set(value);
	}

	// The confirmation page receives live Firestore updates after the modal opens.
	private readonly availableSlotsInput = signal<
		Observable<DateTimeSlot[]> | undefined
	>(undefined);
	@Input()
	public set availableSlots(value: Observable<DateTimeSlot[]>) {
		this.availableSlotsInput.set(value);
	}
	private readonly availableSlotsState = toSignal(
		toObservable(this.availableSlotsInput).pipe(
			switchMap((slots$) =>
				slots$
					? slots$.pipe(
							map((slots) =>
								slots.map((slot) => ({
									...slot,
									dateTime: timestampToDate(slot.dateTime),
								})),
							),
						)
					: of([]),
			),
		),
		{ initialValue: [] },
	);

	public readonly filteredSlots = computed(() =>
		this.availableSlotsState().filter((slot) => slot.enabled),
	);

	public readonly availableDays = computed(() => [
		...new Set(
			this.filteredSlots().map((slot) => toEventDayKey(slot.dateTime)),
		),
	]);

	public readonly availableSlotsByDay = (date: number): DateTimeSlot[] =>
		this.filteredSlots().filter((slot) => toEventDayKey(slot.dateTime) === date);

	public async cancel(): Promise<void> {
		await this.modalController.dismiss(null, 'cancel');
	}

	public async selectSlot(slot: DateTimeSlot): Promise<void> {
		await this.modalController.dismiss(slot, 'confirm');
	}

	public spotsRemaining(slot: DateTimeSlot): string {
		const slots = slot.maxSlots - (slot.slotsReserved ?? 0);

		if (!slot.enabled || slots <= 0) return 'Unavailable';

		return slots === 1 ? `${slots} spot` : `${slots} spots`;
	}

	public isCurrentSlot(slot: DateTimeSlot): boolean {
		const currentSlot = this.currentSlotValue();
		if (!currentSlot) return false;
		return (
			currentSlot.dateTime.getTime() === slot.dateTime.getTime() &&
			currentSlot.id === slot.id
		);
	}
}
