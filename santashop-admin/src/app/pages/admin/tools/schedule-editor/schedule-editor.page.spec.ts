import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { AlertController } from '@ionic/angular/standalone';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { DateTimeSlot } from '@santashop/models';
import { provideProgramYearMock } from '../../../../../test-helpers';
import { ScheduleEditorPage } from './schedule-editor.page';
import { ScheduleEditorService } from './schedule-editor.service';

type ScheduleEditorRowLike = Parameters<
	ScheduleEditorPage['updateCapacity']
>[0];

describe('ScheduleEditorPage', () => {
	let component: ScheduleEditorPage;
	let fixture: ComponentFixture<ScheduleEditorPage>;
	let slotsSubject: BehaviorSubject<DateTimeSlot[]>;
	let scheduleEditorService: jasmine.SpyObj<ScheduleEditorService>;
	let alerts: jasmine.SpyObj<AlertController>;

	beforeEach(waitForAsync(() => {
		slotsSubject = new BehaviorSubject<DateTimeSlot[]>([]);
		scheduleEditorService = jasmine.createSpyObj<ScheduleEditorService>(
			'ScheduleEditorService',
			['createSlots', 'bulkUpdate', 'updateSlot', 'deleteSlot', 'setYear', 'refresh'],
		);
		Object.defineProperty(scheduleEditorService, 'slots$', {
			value: slotsSubject.asObservable(),
		});
		scheduleEditorService.createSlots.and.resolveTo({ created: 0, skipped: 0 });
		scheduleEditorService.bulkUpdate.and.resolveTo();
		scheduleEditorService.updateSlot.and.resolveTo();
		scheduleEditorService.deleteSlot.and.resolveTo();

		alerts = jasmine.createSpyObj<AlertController>('AlertController', ['create']);
		alerts.create.and.returnValue(
			Promise.resolve({
				present: jasmine.createSpy('present').and.resolveTo(),
				dismiss: jasmine.createSpy('dismiss').and.resolveTo(),
			} as unknown as HTMLIonAlertElement),
		);

		TestBed.configureTestingModule({
			imports: [ScheduleEditorPage],
			providers: [
				provideProgramYearMock(2025),
				provideRouter([]),
				{ provide: AlertController, useValue: alerts },
			],
		})
			.overrideComponent(ScheduleEditorPage, {
				set: {
					providers: [
						{
							provide: ScheduleEditorService,
							useValue: scheduleEditorService,
						},
					],
				},
			})
			.compileComponents();

		fixture = TestBed.createComponent(ScheduleEditorPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should render disabled rows and capacity badges', async () => {
		// Arrange
		slotsSubject.next([
			createSlot({
				id: 'at-capacity',
				maxSlots: 5,
				slotsReserved: 5,
				enabled: true,
			}),
			createSlot({
				id: 'over-capacity',
				maxSlots: 5,
				slotsReserved: 7,
				enabled: false,
				hour: 11,
			}),
		]);

		// Act
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		// Assert
		expect(fixture.nativeElement.textContent).toContain('At capacity');
		expect(fixture.nativeElement.textContent).toContain('Over capacity');
		expect(fixture.nativeElement.textContent).toContain('Disabled');
		expect(
			fixture.nativeElement.querySelectorAll('.slot-row--disabled'),
		).toHaveSize(1);
	});

	it('should render the save time slot action', async () => {
		// Arrange
		slotsSubject.next([createSlot({ id: 'slot-1' })]);

		// Act
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		// Assert
		expect(fixture.nativeElement.textContent).toContain('Save time slot');
	});

	it('updateCapacity() should reject an empty value', async () => {
		// Arrange
		const slot = createRow({ id: 'slot-1' });

		// Act
		await component.updateCapacity(slot, createValueEvent(''));

		// Assert
		expect(scheduleEditorService.bulkUpdate).not.toHaveBeenCalled();
		expect(alerts.create).toHaveBeenCalled();
	});

	it('updateCapacity() should reject a fractional value', async () => {
		// Arrange
		const slot = createRow({ id: 'slot-1' });

		// Act
		await component.updateCapacity(slot, createValueEvent('1.5'));

		// Assert
		expect(scheduleEditorService.bulkUpdate).not.toHaveBeenCalled();
		expect(alerts.create).toHaveBeenCalled();
	});

	it('updateCapacity() should apply to all selected rows', async () => {
		// Arrange
		const firstSlot = createRow({ id: 'slot-1' });
		const secondSlot = createRow({ id: 'slot-2', hour: 11 });
		slotsSubject.next([firstSlot, secondSlot]);
		component.selectedSlotIds = new Set(['slot-1', 'slot-2']);

		// Act
		await component.updateCapacity(firstSlot, createValueEvent('12'));

		// Assert
		const [updatedSlots, changes] = scheduleEditorService.bulkUpdate.calls
			.mostRecent().args;
		expect(updatedSlots).toHaveSize(2);
		expect(changes).toEqual({ maxSlots: 12 });
	});

	it('applyBulkEdit() should reject invalid negative capacities', async () => {
		// Arrange
		component.selectedSlotIds = new Set(['slot-1']);
		component.bulkEditForm.patchValue({ capacity: -1, enabled: '' });
		slotsSubject.next([createSlot({ id: 'slot-1' })]);

		// Act
		await component.applyBulkEdit();

		// Assert
		expect(scheduleEditorService.bulkUpdate).not.toHaveBeenCalled();
		expect(alerts.create).toHaveBeenCalled();
	});

	it('applyBulkEdit() should reject fractional capacities', async () => {
		// Arrange
		component.selectedSlotIds = new Set(['slot-1']);
		component.bulkEditForm.patchValue({ capacity: 1.5, enabled: '' });
		slotsSubject.next([createSlot({ id: 'slot-1' })]);

		// Act
		await component.applyBulkEdit();

		// Assert
		expect(scheduleEditorService.bulkUpdate).not.toHaveBeenCalled();
		expect(alerts.create).toHaveBeenCalled();
	});

	it('saveSlotDateTime() should persist the edited schedule date and hour together', async () => {
		// Arrange
		const slot = createRow({ id: 'slot-1' });
		component.setSlotDateDraft('slot-1', createValueEvent('2025-12-13'));
		component.setSlotHourDraft('slot-1', createValueEvent(14));

		// Act
		await component.saveSlotDateTime(slot);

		// Assert
		const updatedSlot = scheduleEditorService.updateSlot.calls.mostRecent()
			.args[0] as DateTimeSlot;
		expect(updatedSlot.dateTime.getFullYear()).toBe(2025);
		expect(updatedSlot.dateTime.getMonth()).toBe(11);
		expect(updatedSlot.dateTime.getDate()).toBe(13);
		expect(updatedSlot.dateTime.getHours()).toBe(14);
	});
});

function createSlot(
	overrides: Partial<DateTimeSlot> & { hour?: number } = {},
): DateTimeSlot {
	const hour = overrides.hour ?? 10;
	const slotOverrides = { ...overrides };
	delete slotOverrides.hour;

	return {
		id: 'slot-default',
		programYear: 2025,
		dateTime: new Date(2025, 11, 12, hour, 0, 0, 0),
		maxSlots: 10,
		slotsReserved: 0,
		enabled: true,
		...slotOverrides,
	};
}

function createRow(
	overrides: Partial<DateTimeSlot> & { hour?: number } = {},
): ScheduleEditorRowLike {
	const slot = createSlot(overrides);
	const reserved = slot.slotsReserved ?? 0;
	let capacityState: ScheduleEditorRowLike['capacityState'] = 'available';

	if (reserved > slot.maxSlots) {
		capacityState = 'over-capacity';
	} else if (reserved === slot.maxSlots) {
		capacityState = 'at-capacity';
	}

	return {
		...slot,
		remaining: slot.maxSlots - reserved,
		capacityState,
		slotsReserved: reserved,
	};
}

function createValueEvent(value: string | number | null): Event {
	return {
		detail: {
			value,
		},
	} as CustomEvent<{ value?: string | number | null }> as Event;
}
