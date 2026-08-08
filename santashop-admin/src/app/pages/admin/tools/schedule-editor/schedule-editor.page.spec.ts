import {
	beforeEach,
	describe,
	expect,
	it,
	type Mocked,
	vi,
} from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { DateTimeSlot } from '@santashop/models';
import { AuthService } from '@santashop/core';
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
	let scheduleEditorService: Mocked<ScheduleEditorService>;
	let alerts: Mocked<AlertController>;

	beforeEach(async () => {
		slotsSubject = new BehaviorSubject<DateTimeSlot[]>([]);
		scheduleEditorService = {
			previewCreateSlots: vi
				.fn()
				.mockName('ScheduleEditorService.previewCreateSlots'),
			startCreateSlots: vi
				.fn()
				.mockName('ScheduleEditorService.startCreateSlots'),
			bulkUpdate: vi.fn().mockName('ScheduleEditorService.bulkUpdate'),
			updateSlot: vi.fn().mockName('ScheduleEditorService.updateSlot'),
			deleteSlot: vi.fn().mockName('ScheduleEditorService.deleteSlot'),
			setYear: vi.fn().mockName('ScheduleEditorService.setYear'),
			refresh: vi.fn().mockName('ScheduleEditorService.refresh'),
		} as unknown as Mocked<ScheduleEditorService>;
		Object.defineProperty(scheduleEditorService, 'slots$', {
			value: slotsSubject.asObservable(),
		});
		scheduleEditorService.startCreateSlots.mockResolvedValue({
			created: 0,
			skipped: 0,
		});
		scheduleEditorService.previewCreateSlots.mockResolvedValue({
			previewId: 'preview-1',
			operation: 'initialize-schedule',
			projectId: 'test-project',
			programYear: 2025,
			expiresAt: new Date(Date.now() + 60000).toISOString(),
			confirmationPhrase: 'INITIALIZE SCHEDULE test-project 2025',
			counts: { requestedSlots: 1 },
			seasonRestricted: true,
		});
		scheduleEditorService.bulkUpdate.mockResolvedValue(undefined);
		scheduleEditorService.updateSlot.mockResolvedValue(undefined);
		scheduleEditorService.deleteSlot.mockResolvedValue(undefined);

		alerts = {
			create: vi.fn().mockName('AlertController.create'),
		} as unknown as Mocked<AlertController>;
	alerts.create.mockResolvedValue({
			present: vi.fn().mockName('present').mockResolvedValue(undefined),
			dismiss: vi.fn().mockName('dismiss').mockResolvedValue(undefined),
			onDidDismiss: vi
				.fn()
				.mockName('onDidDismiss')
				.mockResolvedValue({ role: 'cancel' }),
		} as unknown as HTMLIonAlertElement);

		TestBed.configureTestingModule({
			imports: [ScheduleEditorPage],
			providers: [
				provideProgramYearMock(2025),
				provideRouter([]),
				{ provide: AlertController, useValue: alerts },
				{
					provide: AuthService,
					useValue: {
						isOwner$: new BehaviorSubject(true),
						reauthenticate: vi
							.fn()
							.mockName('reauthenticate')
							.mockResolvedValue(undefined),
					},
				},
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
		await fixture.whenStable();
	});

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
		await fixture.whenStable();
		await fixture.whenStable();
		await fixture.whenStable();

		// Assert
		expect(fixture.nativeElement.textContent).toContain('At capacity');
		expect(fixture.nativeElement.textContent).toContain('Over capacity');
		expect(fixture.nativeElement.textContent).toContain('Disabled');
		expect(
			fixture.nativeElement.querySelectorAll('.slot-card--disabled'),
		).toHaveLength(1);
	});

	it('should render the save time slot action', async () => {
		// Arrange
		slotsSubject.next([createSlot({ id: 'slot-1' })]);

		// Act
		await fixture.whenStable();
		await fixture.whenStable();
		await fixture.whenStable();

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
		const lastCall = vi.mocked(scheduleEditorService.bulkUpdate).mock.lastCall;
		expect(lastCall).toBeDefined();
		const [updatedSlots, changes] = lastCall!;
		expect(updatedSlots).toHaveLength(2);
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
		const updatedSlot = vi.mocked(scheduleEditorService.updateSlot).mock
			.lastCall![0] as DateTimeSlot;
		expect(updatedSlot.dateTime.getFullYear()).toBe(2025);
		expect(updatedSlot.dateTime.getMonth()).toBe(11);
		expect(updatedSlot.dateTime.getDate()).toBe(13);
		expect(updatedSlot.dateTime.getHours()).toBe(14);
	});

	it('generates schedules after the owner supplies the exact confirmation', async () => {
		alerts.create.mockResolvedValueOnce({
			present: vi.fn().mockResolvedValue(undefined),
			onDidDismiss: vi.fn().mockResolvedValue({
				role: 'confirm',
				data: {
					values: {
						password: 'secret',
						phrase: 'INITIALIZE SCHEDULE test-project 2025',
					},
				},
			}),
		} as unknown as HTMLIonAlertElement);
		scheduleEditorService.startCreateSlots.mockResolvedValue({
			created: 2,
			skipped: 1,
		});
		component.generatorForm.setValue({
			startDate: '2025-12-12',
			endDate: '2025-12-12',
			capacity: 5,
			startHour: 10,
			endHour: 11,
		});

		await component.generateSlots();

		expect(scheduleEditorService.previewCreateSlots).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ maxSlots: 5, programYear: 2025 }),
			]),
		);
		expect(scheduleEditorService.startCreateSlots).toHaveBeenCalledWith(
			'preview-1',
			'INITIALIZE SCHEDULE test-project 2025',
		);
		expect(component.statusMessage).toBe(
			'Created 2 schedules and skipped 1 duplicates.',
		);
	});

	it('does not generate schedules with an invalid form or a cancelled confirmation', async () => {
		await component.generateSlots();
		expect(scheduleEditorService.previewCreateSlots).not.toHaveBeenCalled();

		component.generatorForm.setValue({
			startDate: '2025-12-12',
			endDate: '2025-12-12',
			capacity: 5,
			startHour: 10,
			endHour: 10,
		});
		await component.generateSlots();

		expect(scheduleEditorService.startCreateSlots).not.toHaveBeenCalled();
	});

	it('applies a combined bulk capacity and enabled update then resets the form', async () => {
		slotsSubject.next([createSlot({ id: 'slot-1' }), createSlot({ id: 'slot-2' })]);
		component.selectedSlotIds = new Set(['slot-1', 'slot-2']);
		component.bulkEditForm.setValue({ capacity: 8, enabled: 'disabled' });

		await component.applyBulkEdit();

		expect(scheduleEditorService.bulkUpdate).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ id: 'slot-1' }),
				expect.objectContaining({ id: 'slot-2' }),
			]),
			{ maxSlots: 8, enabled: false },
		);
		expect(component.bulkEditForm.value).toEqual({ capacity: null, enabled: '' });
	});

	it('rejects a bulk operation that has no selected slots or changes', async () => {
		await component.applyBulkEdit();
		expect(alerts.create).toHaveBeenCalledWith(
			expect.objectContaining({ header: 'No schedules selected' }),
		);

		component.selectedSlotIds = new Set(['slot-1']);
		slotsSubject.next([createSlot({ id: 'slot-1' })]);
		await component.applyBulkEdit();
		expect(alerts.create).toHaveBeenCalledWith(
			expect.objectContaining({ header: 'Nothing to update' }),
		);
	});

	it('updates enabled state for the selected rows and reports a service error', async () => {
		const first = createRow({ id: 'slot-1' });
		const second = createRow({ id: 'slot-2' });
		slotsSubject.next([first, second]);
		component.selectedSlotIds = new Set(['slot-1', 'slot-2']);

		await component.updateEnabled(first, createCheckedEvent(false));
		expect(scheduleEditorService.bulkUpdate).toHaveBeenLastCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ id: 'slot-1' }),
				expect.objectContaining({ id: 'slot-2' }),
			]),
			{ enabled: false },
		);

		scheduleEditorService.bulkUpdate.mockRejectedValueOnce(new Error('offline'));
		await component.updateEnabled(first, createCheckedEvent(true));
		expect(alerts.create).toHaveBeenCalledWith(
			expect.objectContaining({ header: 'Unable to update schedules', message: 'offline' }),
		);
	});

	it('maintains selection, valid slot drafts, and date helpers', () => {
		component.toggleSelection('slot-1', createCheckedEvent(true));
		component.toggleSelection('slot-2', createCheckedEvent(true));
		expect(component.selectedCount).toBe(2);
		component.toggleAll([createRow({ id: 'slot-1' }), createRow({ id: 'slot-2' })]);
		expect(component.hasSelections).toBe(false);

		component.setSlotDateDraft('slot-1', createValueEvent('2025-12-13'));
		component.setSlotHourDraft('slot-1', createValueEvent(25));
		const slot = createRow({ id: 'slot-1', hour: 10 });
		expect(component.getSlotDraftDate(slot)).toBe('2025-12-13');
		expect(component.getSlotDraftHour(slot)).toBe(10);
		expect(component.formatHour(0)).toBe('12:00 AM');
		expect(component.formatHour(13)).toBe('1:00 PM');
	});

	it('deletes a confirmed schedule and removes it from the selection', async () => {
		const alert = {
			present: vi.fn().mockResolvedValue(undefined),
			dismiss: vi.fn().mockResolvedValue(undefined),
			onDidDismiss: vi.fn().mockResolvedValue({ role: 'cancel' }),
		};
		alerts.create.mockResolvedValueOnce(alert as unknown as HTMLIonAlertElement);
		component.selectedSlotIds = new Set(['slot-1']);

		await component.confirmDelete(createRow({ id: 'slot-1', slotsReserved: 1 }));
		const options = alerts.create.mock.calls[0]![0] as {
			message: string;
			buttons: { role?: string; handler?: () => Promise<void> }[];
		};
		expect(options.message).toContain('1 reservation');
		await options.buttons.find((button) => button.role === 'destructive')!.handler!();

		expect(scheduleEditorService.deleteSlot).toHaveBeenCalledWith('slot-1');
		expect(component.isSelected('slot-1')).toBe(false);
	});
});

function createSlot(
	overrides: Partial<DateTimeSlot> & {
		hour?: number;
	} = {},
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
	overrides: Partial<DateTimeSlot> & {
		hour?: number;
	} = {},
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
	} as CustomEvent<{
		value?: string | number | null;
	}> as Event;
}

function createCheckedEvent(checked: boolean): Event {
	return { detail: { checked } } as CustomEvent<{ checked: boolean }> as Event;
}
