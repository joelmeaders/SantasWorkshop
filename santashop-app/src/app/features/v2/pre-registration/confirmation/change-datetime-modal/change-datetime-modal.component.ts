import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	inject,
	Input,
} from '@angular/core';
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
import { AsyncPipe, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import type { DateTimeSlot } from '@santashop/models';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import {
	map,
	takeUntil,
	shareReplay,
	distinctUntilChanged,
} from 'rxjs/operators';
import { TimeSlotPipe, timestampToDate } from '@santashop/core';

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

	// Noon UTC stays on the same calendar date when the template formats it as MST.
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
		AsyncPipe,
		DatePipe,
		TranslateModule,
		TimeSlotPipe,
	],
})
export class ChangeDatetimeModalComponent implements OnDestroy {
	private readonly modalController = inject(ModalController);
	private readonly destroy$ = new Subject<void>();

	private _currentSlot?: DateTimeSlot;
	private availableSlotsSubscription?: Subscription;

	@Input()
	public set currentSlot(value: DateTimeSlot) {
		this._currentSlot = {
			...value,
			dateTime: timestampToDate(value.dateTime),
		};
	}

	public get currentSlot(): DateTimeSlot | undefined {
		return this._currentSlot;
	}

	// The confirmation page receives live Firestore updates after the modal opens.
	@Input()
	public set availableSlots(value: Observable<DateTimeSlot[]>) {
		this.availableSlotsSubscription?.unsubscribe();
		this.availableSlotsSubscription = value
			.pipe(takeUntil(this.destroy$))
			.subscribe((slots) =>
				this._availableSlots$.next(
					slots.map((slot) => ({
						...slot,
						dateTime: timestampToDate(slot.dateTime),
					})),
				),
			);
	}

	private readonly _availableSlots$ = new BehaviorSubject<DateTimeSlot[]>([]);

	public readonly filteredSlots$ = this._availableSlots$.pipe(
		takeUntil(this.destroy$),
		map((slots) => slots.filter((slot) => slot.enabled)),
		distinctUntilChanged(
			(prev, curr) => JSON.stringify(prev) === JSON.stringify(curr),
		),
		shareReplay(1),
	);

	public readonly availableDays$ = this.filteredSlots$.pipe(
		takeUntil(this.destroy$),
		map((slots) => slots.map((slot) => toEventDayKey(slot.dateTime))),
		map((dates) => [...new Set(dates)]),
		shareReplay(1),
	);

	public readonly availableSlotsByDay$ = (
		date: number,
	): Observable<DateTimeSlot[]> =>
		this.filteredSlots$.pipe(
			takeUntil(this.destroy$),
			map((slots) =>
				slots.filter(
					(slot) => toEventDayKey(slot.dateTime) === date,
				),
			),
			shareReplay(1),
		);

	public ngOnDestroy(): void {
		this.availableSlotsSubscription?.unsubscribe();
		this.destroy$.next();
		this.destroy$.complete();
	}

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
		const currentSlot = this.currentSlot;
		if (!currentSlot) return false;
		return (
			currentSlot.dateTime.getTime() === slot.dateTime.getTime() &&
			currentSlot.id === slot.id
		);
	}
}
