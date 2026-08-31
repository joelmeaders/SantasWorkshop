import { describe, expect, it } from 'vitest';
import {
	buildDateRange,
	createHourlyScheduleSlots,
	parseLocalDateInput,
} from './schedule-generator';

describe('schedule-generator', () => {
	describe('parseLocalDateInput()', () => {
		it('should parse a yyyy-mm-dd string into a local date', () => {
			// Arrange
			const input = '2025-12-12';

			// Act
			const result = parseLocalDateInput(input);

			// Assert
			expect(result.getFullYear()).toBe(2025);
			expect(result.getMonth()).toBe(11);
			expect(result.getDate()).toBe(12);
		});
	});

	describe('buildDateRange()', () => {
		it('should build an inclusive date range', () => {
			// Arrange
			const startDate = new Date(2025, 11, 12);
			const endDate = new Date(2025, 11, 14);

			// Act
			const result = buildDateRange(startDate, endDate);

			// Assert
			expect(result).toHaveLength(3);
			expect(result[0].getDate()).toBe(12);
			expect(result[1].getDate()).toBe(13);
			expect(result[2].getDate()).toBe(14);
		});

		it('should throw when the end date is before the start date', () => {
			// Arrange
			const startDate = new Date(2025, 11, 14);
			const endDate = new Date(2025, 11, 12);

			// Act
			const action = (): Date[] => buildDateRange(startDate, endDate);

			// Assert
			expect(action).toThrowError(
				'Start date must be on or before end date.',
			);
		});
	});

	describe('createHourlyScheduleSlots()', () => {
		it('should create one slot for each hour on each date', () => {
			// Arrange
			const dates = [new Date(2025, 11, 12), new Date(2025, 11, 13)];

			// Act
			const result = createHourlyScheduleSlots({
				programYear: 2025,
				dates,
				capacity: 40,
				startHour: 10,
				endHour: 12,
			});

			// Assert
			expect(result).toHaveLength(6);
			expect(result[0]).toEqual(
				expect.objectContaining({
					programYear: 2025,
					maxSlots: 40,
					slotsReserved: 0,
					enabled: true,
				}),
			);
			expect(result[0].dateTime.getHours()).toBe(10);
			expect(result[2].dateTime.getHours()).toBe(12);
			expect(result[5].dateTime.getDate()).toBe(13);
		});

		it('should de-duplicate repeated dates before generating slots', () => {
			// Arrange
			const duplicateDate = new Date(2025, 11, 12, 7, 30);

			// Act
			const result = createHourlyScheduleSlots({
				programYear: 2025,
				dates: [duplicateDate, new Date(2025, 11, 12)],
				capacity: 10,
				startHour: 10,
				endHour: 11,
			});

			// Assert
			expect(result).toHaveLength(2);
		});

		it('should throw when the time range is invalid', () => {
			// Arrange
			const dates = [new Date(2025, 11, 12)];

			// Act
			const action = (): void => {
				createHourlyScheduleSlots({
					programYear: 2025,
					dates,
					capacity: 10,
					startHour: 14,
					endHour: 10,
				});
			};

			// Assert
			expect(action).toThrowError(
				'Start hour must be before or equal to end hour.',
			);
		});
	});
});
