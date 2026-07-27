import { Injectable, inject } from '@angular/core';
import {
	FireRepoLite,
	IFireRepoCollection,
	PROGRAM_YEAR,
	timestampToDate,
} from '@santashop/core';
import { COLLECTION_SCHEMA, DateTimeSlot } from '@santashop/models';
import { QueryConstraint, where } from 'firebase/firestore';
import {
	BehaviorSubject,
	firstValueFrom,
	map,
	shareReplay,
	switchMap,
} from 'rxjs';

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
		shareReplay(1),
	);

	public setYear(year: number): void {
		this.year.next(year);
	}

	public refresh(): void {
		this.refreshTrigger.next();
	}

	public async createSlots(
		slots: DateTimeSlot[],
	): Promise<CreateSlotsResult> {
		const existingSlots = await firstValueFrom(this.slots$);
		const existingKeys = new Set(
			existingSlots.map((slot) => this.getDateTimeKey(slot.dateTime)),
		);
		const requestKeys = new Set<string>();
		const uniqueSlots = slots.filter((slot) => {
			const key = this.getDateTimeKey(slot.dateTime);

			if (existingKeys.has(key) || requestKeys.has(key)) {
				return false;
			}

			requestKeys.add(key);
			return true;
		});

		await Promise.all(
			uniqueSlots.map(async (slot) => {
				await firstValueFrom(
					this.dateTimeSlotCollection().add(
						this.toPersistedSlot(slot),
					),
				);
			}),
		);

		this.refresh();

		return {
			created: uniqueSlots.length,
			skipped: slots.length - uniqueSlots.length,
		};
	}

	public async updateSlot(slot: DateTimeSlot): Promise<void> {
		if (!slot.id) {
			throw new TypeError('Slot id is required.');
		}

		this.assertValidSlot(slot);
		await this.assertUniqueDateTime(slot);

		await this.persistSlot(slot);

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
				await this.persistSlot(updatedSlot);
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

	private async persistSlot(slot: DateTimeSlot): Promise<void> {
		if (!slot.id) {
			throw new TypeError('Slot id is required.');
		}

		await firstValueFrom(
			this.dateTimeSlotCollection().update(
				slot.id,
				this.toPersistedSlot(slot),
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

	private async assertUniqueDateTime(slot: DateTimeSlot): Promise<void> {
		const slots = await firstValueFrom(this.slots$);
		const slotKey = this.getDateTimeKey(slot.dateTime);
		const hasDuplicateSlot = slots.some(
			(existingSlot) =>
				existingSlot.id !== slot.id &&
				this.getDateTimeKey(existingSlot.dateTime) === slotKey,
		);

		if (hasDuplicateSlot) {
			throw new Error(this.duplicateSlotMessage);
		}
	}

	private toPersistedSlot(slot: DateTimeSlot): DateTimeSlot {
		const persistedSlot = { ...slot };
		delete persistedSlot.id;

		return {
			...persistedSlot,
			lastUpdated: new Date(),
		};
	}

	private getDateTimeKey(dateTime: Date): string {
		return dateTime.toISOString();
	}
}
