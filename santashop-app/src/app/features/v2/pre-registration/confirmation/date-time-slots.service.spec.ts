import { TestBed } from '@angular/core/testing';
import { FireRepoLite, PROGRAM_YEAR } from '@santashop/core';
import type { DateTimeSlot } from '@santashop/models';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DateTimeSlotsService } from './date-time-slots.service';

describe('DateTimeSlotsService', () => {
	const readMany = vi.fn();
	const collection = vi.fn().mockReturnValue({ readMany });

	beforeEach(() => {
		readMany.mockReset();
		collection.mockClear();
		TestBed.configureTestingModule({
			providers: [
				DateTimeSlotsService,
				{ provide: PROGRAM_YEAR, useValue: 2026 },
				{ provide: FireRepoLite, useValue: { collection } },
			],
		});
	});

	it('converts Firestore timestamps and orders enabled current-season slots', async () => {
		const later = new Date('2026-12-16T18:00:00.000Z');
		const earlier = new Date('2026-12-16T16:00:00.000Z');
		readMany.mockReturnValue(
			of([
				{
					id: 'later',
					programYear: 2026,
					dateTime: { toDate: (): Date => later },
					maxSlots: 10,
					enabled: true,
				},
				{
					id: 'earlier',
					programYear: 2026,
					dateTime: { toDate: (): Date => earlier },
					maxSlots: 10,
					enabled: true,
				},
			] as unknown as DateTimeSlot[]),
		);

		const service = TestBed.inject(DateTimeSlotsService);
		const slots = await firstValueFrom(service.availableSlots$);

		expect(collection).toHaveBeenCalledWith('dateTimeSlots');
		expect(readMany).toHaveBeenCalledWith(expect.any(Array), 'id');
		expect(slots.map((slot) => slot.id)).toEqual(['earlier', 'later']);
		expect(slots[0]?.dateTime).toEqual(earlier);
	});
});
