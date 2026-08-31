import { Injectable, OnDestroy, inject } from '@angular/core';
import {
	FireRepoLite,
	IFireRepoCollection,
	PROGRAM_YEAR,
	timestampToDate,
} from '@santashop/core';
import { Observable, Subject } from 'rxjs';
import { map, shareReplay, takeUntil } from 'rxjs/operators';
import { COLLECTION_SCHEMA, DateTimeSlot } from '@santashop/models';
import { QueryConstraint, where } from 'firebase/firestore';

@Injectable()
export class DateTimeModalService implements OnDestroy {
	private readonly programYear = inject(PROGRAM_YEAR);
	private readonly fireRepo = inject(FireRepoLite);

	private readonly destroy$ = new Subject<void>();

	public readonly availableSlots$ = this.availableSlotsQuery(
		this.programYear,
	).pipe(
		takeUntil(this.destroy$),
		map((data) => {
			for (const s of data) {
				s.dateTime = timestampToDate(s.dateTime);
			}
			return data;
		}),
		map((data) =>
			data
				.slice()
				.sort((a, b) => a.dateTime.valueOf() - b.dateTime.valueOf()),
		),
		shareReplay(1),
	);

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private dateTimeSlotCollection(): IFireRepoCollection<DateTimeSlot> {
		return this.fireRepo.collection<DateTimeSlot>(
			COLLECTION_SCHEMA.dateTimeSlots,
		);
	}

	/**
	 * Returns all time slots for the specified program year
	 * where the field 'enabled' is true.
	 */
	private availableSlotsQuery(
		programYear: number,
	): Observable<DateTimeSlot[]> {
		const queryConstraints: QueryConstraint[] = [
			where('programYear', '==', programYear),
			where('enabled', '==', true),
		];

		return this.dateTimeSlotCollection().readMany(queryConstraints, 'id');
	}
}
