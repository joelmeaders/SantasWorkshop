import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
	provideTranslateServiceMock,
	provideActivatedRouteMock,
} from '../../../../../../test-helpers';
import { ScheduleCardComponent } from './schedule-card.component';

describe('ScheduleCardComponent', () => {
	let component: ScheduleCardComponent;
	let fixture: ComponentFixture<ScheduleCardComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ScheduleCardComponent],
			providers: [
				provideTranslateServiceMock(),
				provideActivatedRouteMock(),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ScheduleCardComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('does not expose disabled slots as current availability', () => {
		fixture.componentRef.setInput('slots', [
			{
				id: 'enabled',
				programYear: 2025,
				dateTime: new Date('2025-12-01T10:00:00'),
				maxSlots: 10,
				enabled: true,
			},
			{
				id: 'disabled',
				programYear: 2025,
				dateTime: new Date('2025-12-02T10:00:00'),
				maxSlots: 10,
				enabled: false,
			},
		]);

		expect(component.availableSlots().map((slot) => slot.id)).toEqual([
			'enabled',
		]);
	});

	it('groups available slots by their local calendar day', () => {
		fixture.componentRef.setInput('canChooseDateTime', true);
		fixture.componentRef.setInput('slots', [
			{
				id: 'morning',
				programYear: 2025,
				dateTime: new Date('2025-12-01T10:00:00'),
				maxSlots: 10,
				enabled: true,
			},
			{
				id: 'afternoon',
				programYear: 2025,
				dateTime: new Date('2025-12-01T14:00:00'),
				maxSlots: 10,
				enabled: true,
			},
			{
				id: 'next-day',
				programYear: 2025,
				dateTime: new Date('2025-12-02T10:00:00'),
				maxSlots: 10,
				enabled: true,
			},
		]);
		fixture.detectChanges();

		expect(component.availableSlotDays().map((day) => day.slots.map((slot) => slot.id))).toEqual([
			['morning', 'afternoon'],
			['next-day'],
		]);
		expect(fixture.nativeElement.querySelectorAll('ion-accordion')).toHaveSize(2);
	});

	it('makes each available time slot a direct selection target', async () => {
		fixture.componentRef.setInput('canChooseDateTime', true);
		fixture.componentRef.setInput('slots', [
			{
				id: 'morning',
				programYear: 2025,
				dateTime: new Date('2025-12-01T10:00:00'),
				maxSlots: 10,
				enabled: true,
			},
		]);
		await fixture.whenStable();

		const slot = fixture.nativeElement.querySelector('[data-select-slot-id="morning"]');
		expect(slot?.tagName).toBe('ION-ITEM');
		expect(fixture.nativeElement.querySelector('ion-button[data-select-slot-id]')).toBeNull();
	});
});
