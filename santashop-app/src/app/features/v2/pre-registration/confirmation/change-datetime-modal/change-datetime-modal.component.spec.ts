import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import type { DateTimeSlot } from '@santashop/models';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createModalControllerMock,
	provideTranslateServiceMock,
} from '../../../../../../test-helpers';
import { ChangeDatetimeModalComponent } from './change-datetime-modal.component';

describe('ChangeDatetimeModalComponent', () => {
	let component: ChangeDatetimeModalComponent;
	let fixture: ComponentFixture<ChangeDatetimeModalComponent>;
	let modalController: { dismiss: ReturnType<typeof vi.fn> };
	const slots = new BehaviorSubject<DateTimeSlot[]>([]);

	const slot = (id: string, dateTime: Date, enabled = true): DateTimeSlot => ({
		id,
		dateTime,
		enabled,
		maxSlots: 3,
		slotsReserved: 1,
	} as DateTimeSlot);

	beforeEach(async (): Promise<void> => {
		modalController = createModalControllerMock() as unknown as {
			dismiss: ReturnType<typeof vi.fn>;
		};
		await TestBed.configureTestingModule({
			imports: [ChangeDatetimeModalComponent],
			providers: [
				provideTranslateServiceMock(),
				{ provide: ModalController, useValue: modalController },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ChangeDatetimeModalComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('currentSlot', slot('current', new Date('2026-12-20T10:00:00')));
		fixture.componentRef.setInput('availableSlots', slots.asObservable());
		await fixture.whenStable();
	});

	it('renders live selectable slots and excludes disabled ones', async (): Promise<void> => {
		slots.next([
			slot('current', new Date('2026-12-20T10:00:00')),
			slot('available', new Date('2026-12-20T11:00:00')),
			slot('disabled', new Date('2026-12-21T11:00:00'), false),
		]);

		await fixture.whenStable();

		expect(fixture.nativeElement.querySelector('[data-change-slot-id="available"]')).toBeTruthy();
		expect(await firstValueFrom(component.availableDays$)).toHaveLength(1);
	});

	it('groups slots by the Denver event date independently of the host timezone', async (): Promise<void> => {
		slots.next([
			slot('afternoon', new Date('2026-12-07T16:00:00.000Z')),
			slot('evening', new Date('2026-12-08T01:00:00.000Z')),
		]);

		const eventDay = Date.UTC(2026, 11, 7, 12);
		expect(await firstValueFrom(component.availableDays$)).toEqual([
			eventDay,
		]);
		expect(
			await firstValueFrom(component.availableSlotsByDay$(eventDay)),
		).toHaveLength(2);
	});

	it('reports availability and dismisses with the selected action', async (): Promise<void> => {
		const selected = slot('selected', new Date('2026-12-20T11:00:00'));

		expect(component.spotsRemaining({ ...selected, slotsReserved: 2 })).toBe('1 spot');
		expect(component.spotsRemaining({ ...selected, enabled: false })).toBe('Unavailable');
		expect(component.isCurrentSlot(component.currentSlot!)).toBe(true);
		expect(component.isCurrentSlot(selected)).toBe(false);

		await component.cancel();
		await component.selectSlot(selected);

		expect(modalController.dismiss).toHaveBeenNthCalledWith(1, null, 'cancel');
		expect(modalController.dismiss).toHaveBeenNthCalledWith(2, selected, 'confirm');
	});
});
