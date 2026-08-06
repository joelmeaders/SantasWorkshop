import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import type { DateTimeSlot } from '@santashop/models';
import { TimeSlotPipe } from '@santashop/core';
import { DatePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IonAccordion, IonAccordionGroup, IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonItem, IonLabel, IonList, IonNote } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, chevronDownOutline, createOutline } from 'ionicons/icons';

interface ScheduleDay {
	key: string;
	dateTime: Date;
	slots: DateTimeSlot[];
}

@Component({
	selector: 'app-schedule-card',
	templateUrl: './schedule-card.component.html',
	styleUrls: ['./schedule-card.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, TimeSlotPipe, TranslateModule, IonAccordion, IonAccordionGroup, IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonItem, IonLabel, IonList, IonNote],
})
export class ScheduleCardComponent {
	private readonly translate = inject(TranslateService);
	public readonly dateTimeSlot = input<DateTimeSlot | null | undefined>();
	public readonly slots = input<DateTimeSlot[]>([]);
	public readonly canChooseDateTime = input(false);
	public readonly busy = input(false);
	public readonly selectRequested = output<DateTimeSlot | undefined>();
	public readonly expanded = signal(false);
	public readonly availableSlots = computed(() => this.slots().filter((slot) => slot.enabled));
	public readonly availableSlotDays = computed<ScheduleDay[]>(() => {
		const days = new Map<string, ScheduleDay>();

		for (const slot of this.availableSlots()) {
			const dateTime = slot.dateTime;
			const key = this.dayKey(dateTime);
			const day = days.get(key);

			if (day) day.slots.push(slot);
			else days.set(key, { key, dateTime, slots: [slot] });
		}

		return [...days.values()];
	});

	constructor() {
		addIcons({ calendarOutline, chevronDownOutline, createOutline });
		effect(() => {
			if (
				typeof window !== 'undefined' &&
				window.location.hash === '#appointment' &&
				this.canChooseDateTime()
			) {
				this.expanded.set(true);
			}
		});
	}

	public open(): void {
		if (this.canChooseDateTime()) this.expanded.set(true);
	}

	public select(slot: DateTimeSlot): void {
		if (!slot.enabled || this.busy()) return;
		this.selectRequested.emit(slot);
		this.expanded.set(false);
	}

	public spotsRemaining(slot: DateTimeSlot): string {
		const spots = Math.max(0, slot.maxSlots - (slot.slotsReserved ?? 0));
		return spots === 1
			? this.translate.instant('OVERVIEW.CURRENT_SPOT')
			: this.translate.instant('OVERVIEW.CURRENT_SPOTS', { count: spots });
	}

	private dayKey(dateTime: Date): string {
		return [
			dateTime.getFullYear(),
			String(dateTime.getMonth() + 1).padStart(2, '0'),
			String(dateTime.getDate()).padStart(2, '0'),
		].join('-');
	}
}
