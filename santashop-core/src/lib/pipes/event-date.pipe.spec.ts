import { describe, expect, it } from 'vitest';
import { EventDatePipe } from './event-date.pipe';

describe('EventDatePipe', () => {
	const pipe = new EventDatePipe();

	it('keeps an appointment on its Denver day across UTC midnight', () => {
		expect(
			pipe.transform('2026-12-13T00:30:00Z', 'yyyy-MM-dd h:mm a'),
		).toBe('2026-12-12 5:30 PM');
	});

	it('uses daylight saving time for summer appointments', () => {
		expect(pipe.transform('2026-07-12T16:00:00Z', 'h:mm a')).toBe(
			'10:00 AM',
		);
	});

	it('preserves missing values and accepts the Unix epoch', () => {
		expect(pipe.transform(null)).toBeNull();
		expect(pipe.transform(undefined)).toBeNull();
		expect(pipe.transform('')).toBeNull();
		expect(pipe.transform(0, 'yyyy-MM-dd')).toBe('1969-12-31');
	});
});
