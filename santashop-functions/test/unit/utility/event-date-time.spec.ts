import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createZonedDate,
	getDateTimezoneOffset,
	getZonedDateKey,
	getZonedDateParts,
} from '@santashop/models';

afterEach(() => vi.unstubAllEnvs());

describe('event date and time', () => {
	it.each(['UTC', 'America/New_York', 'Asia/Tokyo'])(
		'creates Denver slots independently of a %s host',
		(zone) => {
			vi.stubEnv('TZ', zone);
			expect(createZonedDate('2026-12-12', 10).toISOString()).toBe(
				'2026-12-12T17:00:00.000Z',
			);
			expect(createZonedDate('2026-07-12', 10).toISOString()).toBe(
				'2026-07-12T16:00:00.000Z',
			);
		},
	);

	it.each([
		['2026-03-07', '2026-03-07T17:00:00.000Z'],
		['2026-03-08', '2026-03-08T16:00:00.000Z'],
		['2026-10-31', '2026-10-31T16:00:00.000Z'],
		['2026-11-01', '2026-11-01T17:00:00.000Z'],
	])('uses the correct offset on %s', (day, expected) => {
		expect(createZonedDate(day, 10).toISOString()).toBe(expected);
	});

	it('honors an explicitly configured named zone', () => {
		expect(
			createZonedDate('2026-07-12', 10, 'America/New_York').toISOString(),
		).toBe('2026-07-12T14:00:00.000Z');
	});

	it('does not silently move a slot out of a daylight-saving gap', () => {
		expect(() => createZonedDate('2026-03-08', 2)).toThrow(
			'does not exist',
		);
	});

	it.each(['2026-02-30', '2026-13-01', '2026-1-01', 'invalid'])(
		'rejects invalid calendar date %s',
		(day) => {
			expect(() => createZonedDate(day, 10)).toThrow(RangeError);
		},
	);

	it.each([-1, 24, 10.5, Number.NaN])('rejects invalid hour %s', (hour) => {
		expect(() => createZonedDate('2026-12-12', hour)).toThrow(RangeError);
	});

	it('groups timestamps by the Denver day across UTC midnight', () => {
		expect(getZonedDateKey(new Date('2026-12-13T00:30:00Z'))).toBe(
			'2026-12-12',
		);
		expect(getZonedDateKey(new Date('2026-12-13T07:00:00Z'))).toBe(
			'2026-12-13',
		);
		expect(getZonedDateParts(new Date('2026-12-13T07:00:00Z')).hour).toBe(
			0,
		);
	});

	it('resolves date-specific offsets without losing milliseconds', () => {
		expect(
			getDateTimezoneOffset(new Date('2026-07-12T16:00:00.123Z')),
		).toBe('-06:00');
		expect(
			getDateTimezoneOffset(new Date('2026-12-12T17:00:00.123Z')),
		).toBe('-07:00');
		expect(
			getDateTimezoneOffset(
				new Date('2026-12-12T17:00:00Z'),
				'Asia/Kolkata',
			),
		).toBe('+05:30');
	});
});
