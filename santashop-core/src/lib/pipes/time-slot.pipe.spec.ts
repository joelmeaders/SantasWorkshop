import { TimeSlotPipe } from './time-slot.pipe';

describe('TimeSlotPipe', () => {
	let pipe: TimeSlotPipe;

	beforeEach(() => {
		pipe = new TimeSlotPipe();
	});

	it('should create an instance', () => {
		expect(pipe).toBeTruthy();
	});

	it('should format time slot correctly for morning hours', () => {
		const date = new Date('2024-01-01T10:00:00');
		const result = pipe.transform(date);
		expect(result).toBe('10AM - 11AM');
	});

	it('should format time slot correctly for afternoon hours', () => {
		const date = new Date('2024-01-01T14:00:00');
		const result = pipe.transform(date);
		expect(result).toBe('2PM - 3PM');
	});

	it('should handle AM to PM transition', () => {
		const date = new Date('2024-01-01T11:00:00');
		const result = pipe.transform(date);
		expect(result).toBe('11AM - 12PM');
	});

	it('should handle timezone parameter', () => {
		const date = new Date('2024-01-01T10:00:00Z');
		const result = pipe.transform(date, 'MST');
		expect(result).toContain('AM - ');
		expect(result).toContain('AM');
	});

	it('should return empty string for null/undefined', () => {
		expect(pipe.transform(null as any)).toBe('');
		expect(pipe.transform(undefined as any)).toBe('');
	});

	it('should handle string date input', () => {
		const result = pipe.transform('2024-01-01T10:00:00');
		expect(result).toBe('10AM - 11AM');
	});

	it('should handle timestamp input', () => {
		const timestamp = new Date('2024-01-01T10:00:00').getTime();
		const result = pipe.transform(timestamp);
		expect(result).toBe('10AM - 11AM');
	});
});
