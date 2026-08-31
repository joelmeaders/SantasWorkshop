import { Injectable, inject } from '@angular/core';
import {
	FireRepoLite,
	IFireRepoCollection,
	PROGRAM_YEAR,
	timestampToDate,
} from '@santashop/core';
import { COLLECTION_SCHEMA, DateTimeSlot } from '@santashop/models';
import { where } from 'firebase/firestore';
import { map, shareReplay } from 'rxjs/operators';

/** Live, enabled appointment slots used by the confirmation change-time modal. */
@Injectable()
export class DateTimeSlotsService {
	private readonly programYear = inject(PROGRAM_YEAR);
	private readonly fireRepo = inject(FireRepoLite);

	public readonly availableSlots$ = this.dateTimeSlotCollection()
		.readMany(
			[
				where('programYear', '==', this.programYear),
				where('enabled', '==', true),
			],
			'id',
		)
		.pipe(
			map((slots) =>
				slots
					.map((slot) => ({
						...slot,
						dateTime: timestampToDate(slot.dateTime),
					}))
					.sort((left, right) =>
						left.dateTime.valueOf() - right.dateTime.valueOf(),
					),
			),
			shareReplay(1),
		);

	private dateTimeSlotCollection(): IFireRepoCollection<DateTimeSlot> {
		return this.fireRepo.collection<DateTimeSlot>(
			COLLECTION_SCHEMA.dateTimeSlots,
		);
	}
}
