import { AdminDatePipe } from '../../../../shared/preferences/admin-date.pipe';
import { AdminTimeSlotPipe } from '../../../../shared/preferences/admin-time-slot.pipe';
import { AdminLanguageService } from '../../../../shared/preferences/admin-language.service';
import { createAdminAlert } from '../../../../shared/preferences/admin-overlays';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
	ReactiveFormsModule,
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
	FormsModule,
} from '@angular/forms';
import {
	AuthService,
	PROGRAM_YEAR,
	shopSchedule,
} from '@santashop/core/admin/firestore';
import {
	DateTimeSlot,
	EVENT_TIME_ZONE,
	createZonedDate,
	getZonedDateKey,
	getZonedDateParts,
} from '@santashop/models';
import {
	AlertController,
	IonBadge,
	IonButton,
	IonCard,
	IonCardContent,
	IonCardHeader,
	IonCardTitle,
	IonCheckbox,
	IonContent,
	IonIcon,
	IonInput,
	IonItem,
	IonNote,
	IonSelect,
	IonSelectOption,
	IonToggle,
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
import { tap } from 'rxjs/operators';
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

interface ScheduleEditorDayGroup {
	dateKey: string;
	dateLabel: string;
	slots: ScheduleEditorRow[];
}

type CapacityInputValue = string | number | null | undefined;

@Component({
	selector: 'admin-schedule-editor',
	templateUrl: './schedule-editor.page.html',
	styleUrls: ['./schedule-editor.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ScheduleEditorService],
	imports: [
		AdminDatePipe,
		AdminTextPipe,
		HeaderComponent,
		FormsModule,
		ReactiveFormsModule,
		AdminTimeSlotPipe,
		IonBadge,
		IonButton,
		IonCard,
		IonCardContent,
		IonCardHeader,
		IonCardTitle,
		IonCheckbox,
		IonContent,
		IonIcon,
		IonInput,
		IonItem,
		IonNote,
		IonSelect,
		IonSelectOption,
		IonToggle,
	],
})
export class ScheduleEditorPage {
	public readonly language = inject(AdminLanguageService);
	private readonly scheduleEditorService = inject(ScheduleEditorService);
	private readonly alerts = inject(AlertController);
	private readonly defaultProgramYear = inject(PROGRAM_YEAR);
	private readonly authService = inject(AuthService);

	public readonly availableYears = this.buildYearOptions();
	public readonly isOwner = toSignal(this.authService.isOwner$, {
		initialValue: false,
	});
	public readonly hourOptions = Array.from({ length: 24 }, (_, hour) => hour);

	public year = this.defaultProgramYear;
	private statusSource: string | (() => string) = '';
	public get statusMessage(): string {
		return this.language.text(
			typeof this.statusSource === 'function'
				? this.statusSource()
				: this.statusSource,
		);
	}
	public set statusMessage(value: string | (() => string)) {
		this.statusSource = value;
	}
	public selectedSlotIds = new Set<string>();
	private latestSlots: ScheduleEditorRow[] = [];
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

	private readonly slots$ = this.scheduleEditorService.slots$.pipe(
		map((slots) => slots.map((slot) => this.mapSlotRow(slot))),
		tap((slots) => {
			this.latestSlots = slots;
		}),
		shareReplay(1),
	);

	public readonly slots = toSignal(this.slots$, { initialValue: [] });
	public readonly groupedSlots = computed(() =>
		this.groupSlotsByDate(this.slots()),
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

	public get hasSelections(): boolean {
		return this.selectedCount > 0;
	}

	public get totalSlotCount(): number {
		return this.latestSlots.length;
	}

	public get allLoadedSlotsSelected(): boolean {
		return (
			this.totalSlotCount > 0 &&
			this.selectedCount === this.totalSlotCount
		);
	}

	public trackBySlot(_index: number, slot: ScheduleEditorRow): string {
		return slot.id ?? slot.dateTime.toISOString();
	}

	public trackByDayGroup(
		_index: number,
		group: ScheduleEditorDayGroup,
	): string {
		return group.dateKey;
	}

	public async generateSlots(): Promise<void> {
		if (this.generatorForm.invalid) {
			this.generatorForm.markAllAsTouched();
			return;
		}

		const startDate = this.generatorForm.controls['startDate']
			.value as string;
		const endDate = this.generatorForm.controls['endDate'].value as string;
		const capacity = Number(this.generatorForm.controls['capacity'].value);
		const startHour = Number(
			this.generatorForm.controls['startHour'].value,
		);
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
			const preview =
				await this.scheduleEditorService.previewCreateSlots(slots);
			const confirmation = await this.requestOwnerConfirmation(
				preview.confirmationPhrase,
			);
			if (!confirmation) return;
			await this.authService.reauthenticate(confirmation.password);
			const result = await this.scheduleEditorService.startCreateSlots(
				preview.previewId,
				confirmation.phrase,
			);
			this.statusMessage = (): string =>
				result.skipped
					? this.language.text(
							'Created {{created}} schedules and skipped {{skipped}} duplicates.',
							{
								created: result.created,
								skipped: result.skipped,
							},
						)
					: this.language.text('Created {{created}} schedules.', {
							created: result.created,
						});
		} catch (error: unknown) {
			await this.showError(
				'Unable to generate schedules',
				this.errorMessage(error),
			);
		}
	}

	private async requestOwnerConfirmation(
		confirmationPhrase: string,
	): Promise<{ password: string; phrase: string } | undefined> {
		let validation: string | undefined;
		const instructions = (): string =>
			this.language.text(
				'This owner-only action is season restricted. Type: {{phrase}}',
				{ phrase: confirmationPhrase },
			);
		const dialogMessage = (): string => validation
			? this.language.text(validation, { v0: instructions() })
			: instructions();
		const alert = await createAdminAlert(this.alerts, () => ({
			header: 'Initialize schedules?',
			message: dialogMessage(),
			inputs: [
				{
					name: 'password',
					type: 'password',
					placeholder: 'Account password',
					attributes: { autocomplete: 'current-password' },
				},
				{
					name: 'phrase',
					type: 'text',
					placeholder: 'Exact confirmation phrase',
				},
			],
			buttons: [
				{ text: 'Cancel', role: 'cancel' },
				{
					text: 'Initialize',
					role: 'confirm',
					handler: (values: {
						password?: string;
						phrase?: string;
					}): boolean => {
						if (!values.password?.trim()) {
							validation = 'Enter your account password. {{v0}}';
							alert.message = dialogMessage();
							return false;
						}
						if (values.phrase?.trim() !== confirmationPhrase) {
							validation =
								'The confirmation phrase does not match. {{v0}}';
							alert.message = dialogMessage();
							return false;
						}
						return true;
					},
				},
			],
		}));
		await alert.present();
		const result = await alert.onDidDismiss<{
			values?: {
				password?: string;
				phrase?: string;
			};
		}>();
		const password = result.data?.values?.password?.trim();
		const phrase = result.data?.values?.phrase?.trim();
		if (
			result.role !== 'confirm' ||
			!password ||
			phrase !== confirmationPhrase
		) {
			return undefined;
		}
		return { password, phrase };
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

		if (changes.maxSlots === undefined && changes.enabled === undefined) {
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

		this.statusMessage = (): string =>
			this.language.text('Updated {{v0}} selected schedules.', {
				v0: selectedSlots.length,
			});
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

	public toggleSelection(slotId: string | undefined, event: Event): void {
		if (!slotId) {
			return;
		}

		const checked = (event as CustomEvent<{ checked: boolean }>).detail
			.checked;
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

	public toggleAllLoadedSlots(): void {
		this.toggleAll(this.latestSlots);
	}

	public setSlotDateDraft(slotId: string | undefined, event: Event): void {
		if (!slotId) {
			return;
		}

		const value = (event as CustomEvent<{ value?: string | null }>).detail
			.value;

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

		const rawValue = (
			event as CustomEvent<{
				value?: string | number | null;
			}>
		).detail.value;

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
		const rawValue = (
			event as CustomEvent<{
				value?: string | number | null;
			}>
		).detail.value;
		let value: number;

		try {
			value = this.parseRequiredCapacity(rawValue);
		} catch (error: unknown) {
			await this.showError('Invalid capacity', this.errorMessage(error));
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

		this.statusMessage = (): string =>
			this.language.text('Updated capacity on {{v0}} schedule{{v1}}.', {
				v0: selectedSlots.length,
				v1: selectedSlots.length === 1 ? '' : 's',
			});
	}

	public async saveSlotDateTime(slot: ScheduleEditorRow): Promise<void> {
		if (!slot.id) {
			return;
		}

		const draftDate =
			this.slotDateDrafts.get(slot.id) ??
			this.formatDateInput(slot.dateTime);
		const draftHour =
			this.slotHourDrafts.get(slot.id) ??
			getZonedDateParts(slot.dateTime).hour;

		if (!Number.isInteger(draftHour) || draftHour < 0 || draftHour > 23) {
			await this.showError(
				'Invalid time',
				'Hour must be between 0 and 23.',
			);
			return;
		}

		try {
			const updatedDateTime = createZonedDate(draftDate, draftHour);

			await this.scheduleEditorService.updateSlotDateTime(
				slot.id,
				updatedDateTime,
			);
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
		const enabled = (event as CustomEvent<{ checked: boolean }>).detail
			.checked;
		const selectedSlots = await this.getEditableSlots(slot);

		try {
			await this.scheduleEditorService.bulkUpdate(selectedSlots, {
				enabled,
			});
		} catch (error: unknown) {
			await this.showError(
				'Unable to update schedules',
				this.errorMessage(error),
			);
			return;
		}

		this.statusMessage = (): string =>
			this.language.text('{{v0}} {{v1}} schedule{{v2}}.', {
				v0: this.language.text(enabled ? 'Enabled' : 'Disabled'),
				v1: selectedSlots.length,
				v2: selectedSlots.length === 1 ? '' : 's',
			});
	}

	public async confirmDelete(slot: ScheduleEditorRow): Promise<void> {
		if (!slot.id) {
			return;
		}

		const reservations = slot.slotsReserved ?? 0;
		const deleteMessage = (): string =>
			reservations > 0
				? this.language.text(
						'This slot already has {{count}} reservations. Deleting it cannot be undone.',
						{ count: reservations },
					)
				: this.language.text(
						'Deleting this schedule cannot be undone.',
					);
		const alert = await createAdminAlert(this.alerts, () => ({
			header: 'Delete schedule?',
			subHeader: this.language.text('{{v0}} {{v1}}', {
				v0: slot.dateTime.toLocaleDateString(this.language.locale(), {
					timeZone: EVENT_TIME_ZONE,
				}),
				v1: this.formatHour(getZonedDateParts(slot.dateTime).hour),
			}),
			message: deleteMessage(),
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
							await this.scheduleEditorService.deleteSlot(
								slot.id as string,
							);
							this.selectedSlotIds.delete(slot.id as string);
							this.selectedSlotIds = new Set(
								this.selectedSlotIds,
							);
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
		}));

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
		const alert = await createAdminAlert(this.alerts, () => ({
			header,
			message,
			buttons: ['OK'],
		}));

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

	private parseRequiredCapacity(rawValue: CapacityInputValue): number {
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
		return new Intl.DateTimeFormat(this.language.locale(), {
			hour: 'numeric',
			minute: '2-digit',
			timeZone: 'UTC',
		}).format(new Date(Date.UTC(2000, 0, 1, hour)));
	}

	public countSelectedSlots(slots: ScheduleEditorRow[]): number {
		return slots.filter((slot) => this.isSelected(slot.id)).length;
	}

	public formatDateInput(date: Date): string {
		return getZonedDateKey(date);
	}

	public getSlotDraftDate(slot: ScheduleEditorRow): string {
		return slot.id
			? (this.slotDateDrafts.get(slot.id) ??
					this.formatDateInput(slot.dateTime))
			: this.formatDateInput(slot.dateTime);
	}

	public getSlotDraftHour(slot: ScheduleEditorRow): number {
		return slot.id
			? (this.slotHourDrafts.get(slot.id) ??
					getZonedDateParts(slot.dateTime).hour)
			: getZonedDateParts(slot.dateTime).hour;
	}

	private groupSlotsByDate(
		slots: ScheduleEditorRow[],
	): ScheduleEditorDayGroup[] {
		const groupedSlots = slots.reduce<Map<string, ScheduleEditorRow[]>>(
			(acc, slot) => {
				const dateKey = this.formatDateInput(slot.dateTime);
				const currentSlots = acc.get(dateKey) ?? [];
				currentSlots.push(slot);
				acc.set(dateKey, currentSlots);
				return acc;
			},
			new Map<string, ScheduleEditorRow[]>(),
		);

		return Array.from(groupedSlots.entries()).map(
			([dateKey, daySlots]) => ({
				dateKey,
				dateLabel: daySlots[0].dateTime.toLocaleDateString(
					this.language.locale(),
					{
						timeZone: EVENT_TIME_ZONE,
						weekday: 'long',
						month: 'short',
						day: 'numeric',
						year: 'numeric',
					},
				),
				slots: daySlots,
			}),
		);
	}
}
