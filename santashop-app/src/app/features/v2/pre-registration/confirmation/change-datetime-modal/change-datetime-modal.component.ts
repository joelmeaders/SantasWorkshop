import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  inject,
  Input,
  input
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
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import {
	map,
	takeUntil,
	shareReplay,
	distinctUntilChanged,
} from 'rxjs/operators';
import { TimeSlotPipe } from '@santashop/core';

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

	readonly currentSlot = input.required<DateTimeSlot>();
	// TODO: Skipped for migration because:
	//  Accessor inputs cannot be migrated as they are too complex.
	@Input()
	set availableSlots(value: DateTimeSlot[]) {
		this._availableSlots$.next(value);
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
		map((slots) =>
			slots.map((slot) => Date.parse(slot.dateTime.toDateString())),
		),
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
					(slot) => Date.parse(slot.dateTime.toDateString()) === date,
				),
			),
			shareReplay(1),
		);

	public ngOnDestroy(): void {
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
		const currentSlot = this.currentSlot();
  if (!currentSlot) return false;
		return (
			currentSlot.dateTime.getTime() === slot.dateTime.getTime() &&
			currentSlot.id === slot.id
		);
	}
}
