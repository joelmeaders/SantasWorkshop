import { Injectable, inject } from '@angular/core';
import {
	FireRepoLite,
	IFireRepoCollection,
	PROGRAM_YEAR,
	timestampToDate,
} from '@santashop/core/admin/firestore';
import { COLLECTION_SCHEMA, DateTimeSlot } from '@santashop/models';
import { QueryConstraint, where } from 'firebase/firestore';
import {
	BehaviorSubject,
	firstValueFrom,
	map,
	shareReplay,
	switchMap,
} from 'rxjs';
import {
	OwnerOperation,
	PreviewOwnerOperationResponse,
} from '@santashop/models';
import { OwnerOperationsService } from '../owner-operations/owner-operations.service';

export interface BulkSlotUpdate {
	maxSlots?: number;
	enabled?: boolean;
}

export interface CreateSlotsResult {
	created: number;
	skipped: number;
}

@Injectable()
export class ScheduleEditorService {
	private readonly fireRepo = inject(FireRepoLite);
	private readonly ownerOperations = inject(OwnerOperationsService);
	private readonly defaultProgramYear = inject(PROGRAM_YEAR);
	private readonly invalidCapacityMessage =
		'Capacity must be a whole number zero or greater.';
	private readonly invalidDateTimeMessage =
		'Schedule date and time must be valid.';
	private readonly duplicateSlotMessage =
		'A schedule already exists for that date and time.';

	private readonly year = new BehaviorSubject<number>(
		this.defaultProgramYear,
	);
	private readonly refreshTrigger = new BehaviorSubject<void>(undefined);

	public readonly year$ = this.year.asObservable().pipe(shareReplay(1));

	public readonly slots$ = this.year.pipe(
		switchMap((year) =>
			this.refreshTrigger.pipe(
				switchMap(() => {
					const queryConstraints: QueryConstraint[] = [
						where('programYear', '==', year),
					];

					return this.dateTimeSlotCollection()
						.readMany(queryConstraints, 'id')
						.pipe(
							map((slots) =>
								slots.map((slot) => ({
									...slot,
									dateTime: timestampToDate(slot.dateTime),
									slotsReserved: slot.slotsReserved ?? 0,
								})),
							),
							map((slots) => this.sortSlots(slots)),
						);
				}),
			),
		),
		shareReplay({ bufferSize: 1, refCount: true }),
	);

	public setYear(year: number): void {
		this.year.next(year);
	}

	public refresh(): void {
		this.refreshTrigger.next();
	}

	public async previewCreateSlots(
		slots: DateTimeSlot[],
	): Promise<PreviewOwnerOperationResponse> {
		const programYear = slots[0]?.programYear;
		return this.ownerOperations.preview({
			operation: 'initialize-schedule',
			programYear,
			slots: slots.map((slot) => ({
				programYear: slot.programYear,
				dateTime: slot.dateTime.toISOString(),
				maxSlots: slot.maxSlots,
				enabled: slot.enabled ?? true,
			})),
		});
	}

	public async startCreateSlots(
		previewId: string,
		confirmationPhrase: string,
	): Promise<CreateSlotsResult> {
		const started = await this.ownerOperations.start({
			previewId,
			confirmationPhrase,
		});
		let operation: OwnerOperation;
		do {
			await new Promise((resolve) => setTimeout(resolve, 500));
			operation = await this.ownerOperations.get(started.operationId);
		} while (
			operation.status !== 'succeeded' &&
			operation.status !== 'failed'
		);
		if (operation.status === 'failed') {
			throw new Error(
				operation.errorMessage ?? 'Schedule initialization failed.',
			);
		}
		this.refresh();
		return {
			created: Number(operation.result?.['created'] ?? 0),
			skipped: Number(operation.result?.['skipped'] ?? 0),
		};
	}

	public async updateSlot(slot: DateTimeSlot): Promise<void> {
		if (!slot.id) {
			throw new TypeError('Slot id is required.');
		}

		this.assertValidSlot(slot);
		await this.updateSlotDateTime(slot.id, slot.dateTime);
	}

	public async updateSlotDateTime(
		slotId: string,
		dateTime: Date,
	): Promise<void> {
		if (!slotId) {
			throw new TypeError('Slot id is required.');
		}

		this.assertValidDateTime(dateTime);
		await this.assertUniqueDateTime(slotId, dateTime);
		await this.persistSlotPatch(slotId, { dateTime });

		this.refresh();
	}

	public async bulkUpdate(
		slots: DateTimeSlot[],
		changes: BulkSlotUpdate,
	): Promise<void> {
		if (changes.maxSlots !== undefined) {
			this.assertValidCapacity(changes.maxSlots);
		}

		await Promise.all(
			slots.map(async (slot) => {
				const updatedSlot: DateTimeSlot = {
					...slot,
					maxSlots: changes.maxSlots ?? slot.maxSlots,
					enabled: changes.enabled ?? slot.enabled,
				};

				this.assertValidSlot(updatedSlot);
				const patch: Partial<DateTimeSlot> = {};
				if (changes.maxSlots !== undefined) {
					patch.maxSlots = changes.maxSlots;
				}
				if (changes.enabled !== undefined) {
					patch.enabled = changes.enabled;
				}
				await this.persistSlotPatch(slot.id, patch);
			}),
		);

		if (slots.length > 0) {
			this.refresh();
		}
	}

	public async deleteSlot(slotId: string): Promise<void> {
		await firstValueFrom(this.dateTimeSlotCollection().delete(slotId));
		this.refresh();
	}

	private dateTimeSlotCollection(): IFireRepoCollection<DateTimeSlot> {
		return this.fireRepo.collection<DateTimeSlot>(
			COLLECTION_SCHEMA.dateTimeSlots,
		);
	}

	private sortSlots(slots: DateTimeSlot[]): DateTimeSlot[] {
		return [...slots].sort(
			(left, right) => left.dateTime.valueOf() - right.dateTime.valueOf(),
		);
	}

	private async persistSlotPatch(
		slotId: string | undefined,
		patch: Partial<DateTimeSlot>,
	): Promise<void> {
		if (!slotId) {
			throw new TypeError('Slot id is required.');
		}

		await firstValueFrom(
			this.dateTimeSlotCollection().update(
				slotId,
				{
					...patch,
					lastUpdated: new Date(),
				} as DateTimeSlot,
				true,
			),
		);
	}

	private assertValidSlot(slot: DateTimeSlot): void {
		this.assertValidDateTime(slot.dateTime);
		this.assertValidCapacity(slot.maxSlots);
	}

	private assertValidCapacity(capacity: number): void {
		if (
			!Number.isFinite(capacity) ||
			!Number.isInteger(capacity) ||
			capacity < 0
		) {
			throw new TypeError(this.invalidCapacityMessage);
		}
	}

	private assertValidDateTime(dateTime: Date): void {
		if (!(dateTime instanceof Date) || Number.isNaN(dateTime.valueOf())) {
			throw new TypeError(this.invalidDateTimeMessage);
		}
	}

	private async assertUniqueDateTime(
		slotId: string,
		dateTime: Date,
	): Promise<void> {
		const slots = await firstValueFrom(this.slots$);
		const slotKey = this.getDateTimeKey(dateTime);
		const hasDuplicateSlot = slots.some(
			(existingSlot) =>
				existingSlot.id !== slotId &&
				this.getDateTimeKey(existingSlot.dateTime) === slotKey,
		);

		if (hasDuplicateSlot) {
			throw new Error(this.duplicateSlotMessage);
		}
	}

	private getDateTimeKey(dateTime: Date): string {
		return dateTime.toISOString();
	}
}
