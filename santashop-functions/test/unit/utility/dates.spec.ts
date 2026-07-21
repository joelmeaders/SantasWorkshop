import { describe, expect, it } from 'vitest';
import { getAgeFromDate, getAgeGroupFromAge } from '../../../src/utility/dates';
import { AgeGroup } from '@santashop/models';

describe('dates utility', () => {
	it('calculates age when the birthday already happened this year', () => {
		const birthday = new Date('2018-01-10T00:00:00.000Z');
		const fromDate = new Date('2025-12-01T00:00:00.000Z');

		const age = getAgeFromDate(birthday, fromDate);

		expect(age).toBe(7);
	});

	it('calculates age when the birthday has not happened yet this year', () => {
		const birthday = new Date('2018-12-15T00:00:00.000Z');
		const fromDate = new Date('2025-12-01T00:00:00.000Z');

		const age = getAgeFromDate(birthday, fromDate);

		expect(age).toBe(6);
	});

	it('maps supported ages to the expected age groups', () => {
		expect(getAgeGroupFromAge(0)).toBe(AgeGroup.age02);
		expect(getAgeGroupFromAge(2)).toBe(AgeGroup.age02);
		expect(getAgeGroupFromAge(3)).toBe(AgeGroup.age35);
		expect(getAgeGroupFromAge(5)).toBe(AgeGroup.age35);
		expect(getAgeGroupFromAge(6)).toBe(AgeGroup.age68);
		expect(getAgeGroupFromAge(8)).toBe(AgeGroup.age68);
		expect(getAgeGroupFromAge(9)).toBe(AgeGroup.age911);
		expect(getAgeGroupFromAge(11)).toBe(AgeGroup.age911);
	});

	it('throws for unsupported ages', () => {
		expect(() => getAgeGroupFromAge(-1)).toThrowError('invalid age');
		expect(() => getAgeGroupFromAge(12)).toThrowError('invalid age');
	});
});
