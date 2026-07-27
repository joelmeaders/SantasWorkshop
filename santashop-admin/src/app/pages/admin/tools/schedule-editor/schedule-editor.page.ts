import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
	ReactiveFormsModule,
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
	FormsModule,
} from '@angular/forms';
import { PROGRAM_YEAR, TimeSlotPipe, shopSchedule } from '@santashop/core';
import { DateTimeSlot } from '@santashop/models';
import {
	AlertController,
	IonBadge,
	IonButton,
	IonButtons,
	IonCard,
	IonCardContent,
	IonCardHeader,
	IonCardTitle,
	IonCheckbox,
	IonContent,
	IonIcon,
	IonInput,
	IonItem,
	IonList,
	IonNote,
	IonSelect,
	IonSelectOption,
	IonToggle,
	IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
	addCircleOutline,
	calendarOutline,
	createOutline,
	saveOutline,
	removeCircleOutline,
	trashOutline,
} from 'ionicons/icons';
import { firstValueFrom, map, shareReplay } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import {
	buildDateRange,
	createHourlyScheduleSlots,
	parseLocalDateInput,
} from './schedule-generator';
import {
	BulkSlotUpdate,
	ScheduleEditorService,
} from './schedule-editor.service';

interface ScheduleEditorRow extends DateTimeSlot {
	capacityState: 'available' | 'at-capacity' | 'over-capacity';
	remaining: number;
	slotsReserved: number;
}

type CapacityInputValue = string | number | null | undefined;

@Component({
	selector: 'admin-schedule-editor',
	templateUrl: './schedule-editor.page.html',
	styleUrls: ['./schedule-editor.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ScheduleEditorService],
	imports: [
		HeaderComponent,
		AsyncPipe,
		DatePipe,
		FormsModule,
		ReactiveFormsModule,
		TimeSlotPipe,
		IonBadge,
		IonButton,
		IonButtons,
		IonCard,
		IonCardContent,
		IonCardHeader,
		IonCardTitle,
		IonCheckbox,
		IonContent,
		IonIcon,
		IonInput,
		IonItem,
		IonList,
		IonNote,
		IonSelect,
		IonSelectOption,
		IonToggle,
		IonToolbar,
	],
})
export class ScheduleEditorPage {
	private readonly scheduleEditorService = inject(ScheduleEditorService);
	private readonly alerts = inject(AlertController);
	private readonly defaultProgramYear = inject(PROGRAM_YEAR);

	public readonly availableYears = this.buildYearOptions();
	public readonly hourOptions = Array.from({ length: 24 }, (_, hour) => hour);

	public year = this.defaultProgramYear;
	public statusMessage = '';
	public selectedSlotIds = new Set<string>();
	private readonly slotDateDrafts = new Map<string, string>();
	private readonly slotHourDrafts = new Map<string, number>();

	public readonly generatorForm = new UntypedFormGroup({
		startDate: new UntypedFormControl('', Validators.required),
		endDate: new UntypedFormControl('', Validators.required),
		capacity: new UntypedFormControl(0, [
			Validators.required,
			Validators.min(0),
		]),
		startHour: new UntypedFormControl(10, Validators.required),
		endHour: new UntypedFormControl(14, Validators.required),
	});

	public readonly bulkEditForm = new UntypedFormGroup({
		capacity: new UntypedFormControl(null, [Validators.min(0)]),
		enabled: new UntypedFormControl(''),
	});

	public readonly slots$ = this.scheduleEditorService.slots$.pipe(
		map((slots) => slots.map((slot) => this.mapSlotRow(slot))),
		shareReplay(1),
	);

	constructor() {
		addIcons({
			calendarOutline,
			addCircleOutline,
			createOutline,
			saveOutline,
			removeCircleOutline,
			trashOutline,
		});
	}

	public get selectedCount(): number {
		return this.selectedSlotIds.size;
	}

	public trackBySlot(_index: number, slot: ScheduleEditorRow): string {
		return slot.id ?? slot.dateTime.toISOString();
	}

	public async generateSlots(): Promise<void> {
		if (this.generatorForm.invalid) {
			this.generatorForm.markAllAsTouched();
			return;
		}

		const startDate = this.generatorForm.controls['startDate'].value as string;
		const endDate = this.generatorForm.controls['endDate'].value as string;
		const capacity = Number(this.generatorForm.controls['capacity'].value);
		const startHour = Number(this.generatorForm.controls['startHour'].value);
		const endHour = Number(this.generatorForm.controls['endHour'].value);

		try {
			const dates = buildDateRange(
				parseLocalDateInput(startDate),
				parseLocalDateInput(endDate),
			);
			const slots = createHourlyScheduleSlots({
				programYear: this.year,
				dates,
				capacity,
				startHour,
				endHour,
			});
			const result = await this.scheduleEditorService.createSlots(slots);
			this.statusMessage =
				result.skipped > 0
					? `Created ${result.created} schedules and skipped ${result.skipped} duplicates.`
					: `Created ${result.created} schedules.`;
		} catch (error: unknown) {
			await this.showError(
				'Unable to generate schedules',
				this.errorMessage(error),
			);
		}
	}

	public async applyBulkEdit(): Promise<void> {
		if (this.selectedCount === 0) {
			await this.showError(
				'No schedules selected',
				'Select one or more rows before applying a bulk edit.',
			);
			return;
		}

		const selectedSlots = await this.getSelectedSlots();
		const capacityValue = this.bulkEditForm.controls['capacity']
			.value as CapacityInputValue;
		const enabledValue = this.bulkEditForm.controls['enabled'].value;
		const changes: BulkSlotUpdate = {};

		try {
			const parsedCapacity = this.parseOptionalCapacity(capacityValue);

			if (parsedCapacity !== undefined) {
				changes.maxSlots = parsedCapacity;
			}
		} catch (error: unknown) {
			await this.showError('Invalid capacity', this.errorMessage(error));
			return;
		}

		if (enabledValue === 'enabled') {
			changes.enabled = true;
		}

		if (enabledValue === 'disabled') {
			changes.enabled = false;
		}

		if (
			changes.maxSlots === undefined &&
			changes.enabled === undefined
		) {
			await this.showError(
				'Nothing to update',
				'Choose a capacity or enabled state to apply.',
			);
			return;
		}

		try {
			await this.scheduleEditorService.bulkUpdate(selectedSlots, changes);
		} catch (error: unknown) {
			await this.showError(
				'Unable to update schedules',
				this.errorMessage(error),
			);
			return;
		}

		this.statusMessage = `Updated ${selectedSlots.length} selected schedules.`;
		this.bulkEditForm.patchValue({ capacity: null, enabled: '' });
	}

	public onYearChange(): void {
		this.selectedSlotIds = new Set<string>();
		this.statusMessage = '';
		this.scheduleEditorService.setYear(this.year);
	}

	public isSelected(slotId?: string): boolean {
		return !!slotId && this.selectedSlotIds.has(slotId);
	}

	public toggleSelection(
		slotId: string | undefined,
		event: Event,
	): void {
		if (!slotId) {
			return;
		}

		const checked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
		const next = new Set(this.selectedSlotIds);

		if (checked) {
			next.add(slotId);
		} else {
			next.delete(slotId);
		}

		this.selectedSlotIds = next;
	}

	public toggleAll(slots: ScheduleEditorRow[]): void {
		if (this.selectedCount === slots.length) {
			this.selectedSlotIds = new Set<string>();
			return;
		}

		this.selectedSlotIds = new Set(
			slots
				.map((slot) => slot.id)
				.filter((slotId): slotId is string => !!slotId),
		);
	}

	public clearSelection(): void {
		this.selectedSlotIds = new Set<string>();
	}

	public setSlotDateDraft(slotId: string | undefined, event: Event): void {
		if (!slotId) {
			return;
		}

		const value = (event as CustomEvent<{ value?: string | null }>).detail.value;

		if (!value) {
			this.slotDateDrafts.delete(slotId);
			return;
		}

		this.slotDateDrafts.set(slotId, value);
	}

	public setSlotHourDraft(slotId: string | undefined, event: Event): void {
		if (!slotId) {
			return;
		}

		const rawValue = (event as CustomEvent<{
			value?: string | number | null;
		}>).detail.value;

		if (rawValue === '' || rawValue === null || rawValue === undefined) {
			this.slotHourDrafts.delete(slotId);
			return;
		}

		const nextHour = Number(rawValue);

		if (!Number.isInteger(nextHour) || nextHour < 0 || nextHour > 23) {
			this.slotHourDrafts.delete(slotId);
			return;
		}

		this.slotHourDrafts.set(slotId, nextHour);
	}

	public async updateCapacity(
		slot: ScheduleEditorRow,
		event: Event,
	): Promise<void> {
		const rawValue = (event as CustomEvent<{
			value?: string | number | null;
		}>).detail.value;
		let value = 0;

		try {
			value = this.parseRequiredCapacity(rawValue);
		} catch (error: unknown) {
			await this.showError(
				'Invalid capacity',
				this.errorMessage(error),
			);
			return;
		}

		const selectedSlots = await this.getEditableSlots(slot);

		try {
			await this.scheduleEditorService.bulkUpdate(selectedSlots, {
				maxSlots: value,
			});
		} catch (error: unknown) {
			await this.showError(
				'Unable to update schedules',
				this.errorMessage(error),
			);
			return;
		}

		this.statusMessage = `Updated capacity on ${selectedSlots.length} schedule${selectedSlots.length === 1 ? '' : 's'}.`;
	}

	public async saveSlotDateTime(slot: ScheduleEditorRow): Promise<void> {
		if (!slot.id) {
			return;
		}

		const draftDate = this.slotDateDrafts.get(slot.id) ?? this.formatDateInput(slot.dateTime);
		const draftHour = this.slotHourDrafts.get(slot.id) ?? slot.dateTime.getHours();

		if (!Number.isInteger(draftHour) || draftHour < 0 || draftHour > 23) {
			await this.showError('Invalid time', 'Hour must be between 0 and 23.');
			return;
		}

		try {
			const nextDate = parseLocalDateInput(draftDate);
			const updatedDateTime = new Date(
				nextDate.getFullYear(),
				nextDate.getMonth(),
				nextDate.getDate(),
				draftHour,
				0,
				0,
				0,
			);

			await this.scheduleEditorService.updateSlot({
				...slot,
				dateTime: updatedDateTime,
			});
			this.slotDateDrafts.delete(slot.id);
			this.slotHourDrafts.delete(slot.id);
		} catch (error: unknown) {
			await this.showError(
				'Unable to update schedule time slot',
				this.errorMessage(error),
			);
			return;
		}

		this.statusMessage = 'Updated schedule time slot.';
	}

	public async updateEnabled(
		slot: ScheduleEditorRow,
		event: Event,
	): Promise<void> {
		const enabled = (event as CustomEvent<{ checked: boolean }>).detail.checked;
		const selectedSlots = await this.getEditableSlots(slot);

		try {
			await this.scheduleEditorService.bulkUpdate(selectedSlots, { enabled });
		} catch (error: unknown) {
			await this.showError(
				'Unable to update schedules',
				this.errorMessage(error),
			);
			return;
		}

		this.statusMessage = `${enabled ? 'Enabled' : 'Disabled'} ${selectedSlots.length} schedule${selectedSlots.length === 1 ? '' : 's'}.`;
	}

	public async confirmDelete(slot: ScheduleEditorRow): Promise<void> {
		if (!slot.id) {
			return;
		}

		const reservations = slot.slotsReserved ?? 0;
		const reservationLabel = reservations === 1 ? 'reservation' : 'reservations';
		const deleteMessage =
			reservations > 0
				? `This slot already has ${reservations} ${reservationLabel}. Deleting it cannot be undone.`
				: 'Deleting this schedule cannot be undone.';
		const alert = await this.alerts.create({
			header: 'Delete schedule?',
			subHeader: `${slot.dateTime.toLocaleDateString()} ${this.formatHour(slot.dateTime.getHours())}`,
			message: deleteMessage,
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel',
				},
				{
					text: 'Delete',
					role: 'destructive',
					handler: async (): Promise<void> => {
						try {
							await this.scheduleEditorService.deleteSlot(slot.id as string);
							this.selectedSlotIds.delete(slot.id as string);
							this.selectedSlotIds = new Set(this.selectedSlotIds);
							this.statusMessage = 'Schedule deleted.';
						} catch (error: unknown) {
							await this.showError(
								'Unable to delete schedule',
								this.errorMessage(error),
							);
						}
					},
				},
			],
		});

		await alert.present();
	}

	private buildYearOptions(): number[] {
		return Array.from(
			new Set<number>([
				...shopSchedule.map((schedule) => schedule.year),
				this.defaultProgramYear,
				new Date().getFullYear(),
			]),
		).sort((left, right) => right - left);
	}

	private mapSlotRow(slot: DateTimeSlot): ScheduleEditorRow {
		const reserved = slot.slotsReserved ?? 0;
		const remaining = slot.maxSlots - reserved;
		let capacityState: ScheduleEditorRow['capacityState'] = 'available';

		if (reserved > slot.maxSlots) {
			capacityState = 'over-capacity';
		} else if (reserved === slot.maxSlots) {
			capacityState = 'at-capacity';
		}

		return {
			...slot,
			slotsReserved: reserved,
			remaining,
			capacityState,
		};
	}

	private async getSelectedSlots(): Promise<ScheduleEditorRow[]> {
		const slots = await firstValueFrom(this.slots$);

		return slots.filter((slot) => this.isSelected(slot.id));
	}

	private async getEditableSlots(
		slot: ScheduleEditorRow,
	): Promise<ScheduleEditorRow[]> {
		if (slot.id && this.selectedCount > 1 && this.isSelected(slot.id)) {
			return this.getSelectedSlots();
		}

		return [slot];
	}

	private async showError(header: string, message: string): Promise<void> {
		const alert = await this.alerts.create({
			header,
			message,
			buttons: ['OK'],
		});

		await alert.present();
	}

	private parseOptionalCapacity(
		rawValue: CapacityInputValue,
	): number | undefined {
		if (rawValue === '' || rawValue === null || rawValue === undefined) {
			return undefined;
		}

		return this.parseCapacityValue(rawValue);
	}

	private parseRequiredCapacity(
		rawValue: CapacityInputValue,
	): number {
		if (rawValue === '' || rawValue === null || rawValue === undefined) {
			throw new TypeError('Capacity is required.');
		}

		return this.parseCapacityValue(rawValue);
	}

	private parseCapacityValue(rawValue: string | number): number {
		const capacity = Number(rawValue);

		if (
			!Number.isFinite(capacity) ||
			!Number.isInteger(capacity) ||
			capacity < 0
		) {
			throw new TypeError(
				'Capacity must be a whole number zero or greater.',
			);
		}

		return capacity;
	}

	private errorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}

		if (typeof error === 'string') {
			return error;
		}

		return 'An unexpected error occurred.';
	}

	public formatHour(hour: number): string {
		const suffix = hour >= 12 ? 'PM' : 'AM';
		const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
		return `${normalizedHour}:00 ${suffix}`;
	}

	public formatDateInput(date: Date): string {
		const year = date.getFullYear();
		const month = `${date.getMonth() + 1}`.padStart(2, '0');
		const day = `${date.getDate()}`.padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	public getSlotDraftDate(slot: ScheduleEditorRow): string {
		return slot.id
			? (this.slotDateDrafts.get(slot.id) ?? this.formatDateInput(slot.dateTime))
			: this.formatDateInput(slot.dateTime);
	}

	public getSlotDraftHour(slot: ScheduleEditorRow): number {
		return slot.id
			? (this.slotHourDrafts.get(slot.id) ?? slot.dateTime.getHours())
			: slot.dateTime.getHours();
	}
}
