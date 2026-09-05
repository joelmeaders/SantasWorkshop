import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Subject } from 'rxjs';
import { FireRepoLite, PROGRAM_YEAR } from '@santashop/core/admin/firestore';
import type { DateTimeSlot } from '@santashop/models';
import { DateTimeModalService } from './date-time-modal.service';
import { requireDefined } from '../../../../test-helpers';

describe('DateTimeModalService', () => {
	let service: DateTimeModalService;
	let slots$: Subject<DateTimeSlot[]>;
	let readMany: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		slots$ = new Subject<DateTimeSlot[]>();
		readMany = vi.fn().mockReturnValue(slots$.asObservable());
		TestBed.configureTestingModule({
			providers: [
				DateTimeModalService,
				{ provide: PROGRAM_YEAR, useValue: 2026 },
				{
					provide: FireRepoLite,
					useValue: {
						collection: vi.fn().mockReturnValue({ readMany }),
					},
				},
			],
		});
		service = TestBed.inject(DateTimeModalService);
	});

	it('queries enabled slots for the program year and returns them in chronological order', async () => {
		const result = firstValueFrom(service.availableSlots$);
		slots$.next([
			createSlot('later', {
				toDate: () => new Date('2026-12-15T13:00:00'),
			}),
			createSlot('earlier', new Date('2026-12-12T10:00:00')),
		]);

		await expect(result).resolves.toEqual([
			expect.objectContaining({
				id: 'earlier',
				dateTime: new Date('2026-12-12T10:00:00'),
			}),
			expect.objectContaining({
				id: 'later',
				dateTime: new Date('2026-12-15T13:00:00'),
			}),
		]);
		expect(readMany).toHaveBeenCalledWith(expect.any(Array), 'id');
		expect(requireDefined(readMany.mock.calls[0])[0]).toHaveLength(2);
	});

	it('shares the latest slot list with multiple subscribers and completes on destroy', async () => {
		const first = firstValueFrom(service.availableSlots$);
		const second = firstValueFrom(service.availableSlots$);
		slots$.next([createSlot('slot-1', new Date('2026-12-12T10:00:00'))]);

		await expect(first).resolves.toHaveLength(1);
		await expect(second).resolves.toHaveLength(1);
		expect(readMany).toHaveBeenCalledTimes(1);

		service.ngOnDestroy();
	});
	it('keeps delivering live changes and releases the listener after the last consumer leaves', () => {
		const lists: DateTimeSlot[][] = [];
		const subscription = service.availableSlots$.subscribe((slots) =>
			lists.push(slots),
		);
		slots$.next([createSlot('one', new Date('2026-12-12'))]);
		slots$.next([createSlot('two', new Date('2026-12-13'))]);
		expect(lists.map((slots) => slots[0]?.id)).toEqual(['one', 'two']);
		expect(slots$.observed).toBe(true);
		subscription.unsubscribe();
		expect(slots$.observed).toBe(false);
	});
});

function createSlot(
	id: string,
	dateTime: Date | { toDate: () => Date },
): DateTimeSlot {
	return {
		id,
		programYear: 2026,
		dateTime: dateTime as Date,
		maxSlots: 5,
		slotsReserved: 0,
		enabled: true,
	};
}
