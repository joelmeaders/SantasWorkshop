import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertController, ModalController } from '@ionic/angular/standalone';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

import { DateTimeModalComponent } from './date-time-modal.component';
import { requireDefined, testHelpers } from '../../../../test-helpers';
import { DateTimeModalService } from './date-time-modal.service';
import type { DateTimeSlot } from '@santashop/models';

describe('DateTimeModalComponent', () => {
	let component: DateTimeModalComponent;
	let fixture: ComponentFixture<DateTimeModalComponent>;
	const slots$ = new BehaviorSubject<DateTimeSlot[]>([]);

	beforeEach(async () => {
		TestBed.overrideComponent(DateTimeModalComponent, {
			set: { providers: [{ provide: DateTimeModalService, useValue: { availableSlots$: slots$ } }] },
		});
		TestBed.configureTestingModule({
			imports: [DateTimeModalComponent],
			providers: [...testHelpers],
		}).compileComponents();

		fixture = TestBed.createComponent(DateTimeModalComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('filters available slots, reports capacity, and dismisses a new selection', async (): Promise<void> => {
		const modal = TestBed.inject(ModalController) as Mocked<ModalController>;
		modal.dismiss.mockResolvedValue(true);
		const open: DateTimeSlot = {
			id: 'open',
			programYear: 2026,
			dateTime: new Date('2026-12-20T10:00:00'),
			enabled: true,
			maxSlots: 2,
			slotsReserved: 1,
		};
		slots$.next([open, { ...open, id: 'closed', enabled: false }]);

		await expect(firstValueFrom(component.availableSlots$)).resolves.toEqual([open]);
		expect(component.spotsRemaining(open)).toBe('1 spot');
		expect(component.spotsRemaining({ ...open, enabled: false })).toBe('Unavailable');
		await component.selectDateTime(open);
		expect(modal.dismiss).toHaveBeenCalledWith(open);
	});

	it('groups enabled choices by day and returns only the selected day slots', async () => {
		const first = createSlot('first', '2026-12-20T10:00:00', 3, 0);
		const second = createSlot('second', '2026-12-20T11:00:00', 3, 2);
		const nextDay = createSlot('next-day', '2026-12-21T10:00:00', 3, 0);
		slots$.next([first, second, nextDay, { ...nextDay, id: 'disabled', enabled: false }]);

		const days = await firstValueFrom(component.availableDays$);
		const sameDaySlots = await firstValueFrom(
			component.availableSlotsByDay$(requireDefined(days[0])),
		);

		expect(days).toHaveLength(2);
		expect(sameDaySlots).toEqual([first, second]);
		expect(component.spotsRemaining({ ...second, slotsReserved: 3 })).toBe('Unavailable');
		expect(component.spotsRemaining({ ...first, slotsReserved: 1 })).toBe('2 spots');
	});

	it('requires confirmation before replacing an existing slot', async () => {
		const current = createSlot('current', '2026-12-20T10:00:00', 3, 0);
		const replacement = createSlot('replacement', '2026-12-21T10:00:00', 3, 0);
		fixture.componentRef.setInput('currentSlot', current);
		await fixture.whenStable();
		const modal = TestBed.inject(ModalController) as Mocked<ModalController>;
		const alerts = TestBed.inject(AlertController) as Mocked<AlertController>;

		alerts.create.mockResolvedValueOnce(createConfirmationAlert('cancel'));
		await component.selectDateTime(replacement);
		expect(modal.dismiss).not.toHaveBeenCalled();

		alerts.create.mockResolvedValueOnce(createConfirmationAlert('confirm'));
		await component.selectDateTime(replacement);
		expect(modal.dismiss).toHaveBeenCalledWith(replacement);
	});

	it('dismisses an explicit empty selection and completes subscriptions on destroy', async () => {
		const modal = TestBed.inject(ModalController) as Mocked<ModalController>;
		await component.selectDateTime();
		expect(modal.dismiss).toHaveBeenCalledWith(undefined);

		component.ngOnDestroy();
		await fixture.whenStable();
	});
});

function createSlot(
	id: string,
	dateTime: string,
	maxSlots: number,
	slotsReserved: number,
): DateTimeSlot {
	return {
		id,
		programYear: 2026,
		dateTime: new Date(dateTime),
		enabled: true,
		maxSlots,
		slotsReserved,
	};
}

function createConfirmationAlert(role: string): HTMLIonAlertElement {
	return {
		present: vi.fn().mockResolvedValue(undefined),
		onDidDismiss: vi.fn().mockResolvedValue({ role }),
	} as unknown as HTMLIonAlertElement;
}
