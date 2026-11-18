import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import { FireRepoLite, PROGRAM_YEAR } from '@santashop/core/admin/firestore';
import type { DateTimeSlot } from '@santashop/models';
import { where } from 'firebase/firestore';
import { DateTimeModalService } from './date-time-modal.service';

describe('DateTimeModalService', () => {
	let service: DateTimeModalService;
	let slots$: Subject<DateTimeSlot[]>;
	let readMany: ReturnType<typeof vi.fn>;
	let sourceSubscriptions: number;
	let sourceTeardowns: number;
	const yearFilter = { fixture: 'program-year' } as unknown as ReturnType<
		typeof where
	>;
	const enabledFilter = { fixture: 'enabled' } as unknown as ReturnType<
		typeof where
	>;

	beforeEach(() => {
		slots$ = new Subject<DateTimeSlot[]>();
		sourceSubscriptions = 0;
		sourceTeardowns = 0;
		readMany = vi.fn().mockReturnValue(
			new Observable<DateTimeSlot[]>((subscriber) => {
				sourceSubscriptions++;
				const subscription = slots$.subscribe(subscriber);
				return (): void => {
					subscription.unsubscribe();
					sourceTeardowns++;
				};
			}),
		);
		vi.mocked(where)
			.mockReset()
			.mockReturnValueOnce(yearFilter)
			.mockReturnValueOnce(enabledFilter);
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
		expect(vi.mocked(where).mock.calls).toEqual([
			['programYear', '==', 2026],
			['enabled', '==', true],
		]);
		expect(readMany).toHaveBeenCalledWith(
			[yearFilter, enabledFilter],
			'id',
		);
	});

	it('shares one listener, replays the latest slots, and closes active subscriptions on destroy', () => {
		const first = vi.fn();
		const second = vi.fn();
		const completed = vi.fn();
		const slots = [createSlot('slot-1', new Date('2026-12-12T10:00:00'))];
		service.availableSlots$.subscribe({ next: first, complete: completed });
		slots$.next(slots);
		service.availableSlots$.subscribe({
			next: second,
			complete: completed,
		});

		expect(first).toHaveBeenCalledWith(slots);
		expect(second).toHaveBeenCalledWith(slots);
		expect(sourceSubscriptions).toBe(1);
		expect(sourceTeardowns).toBe(0);

		service.ngOnDestroy();
		expect(completed).toHaveBeenCalledTimes(2);
		expect(sourceTeardowns).toBe(1);
		expect(slots$.observed).toBe(false);
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
