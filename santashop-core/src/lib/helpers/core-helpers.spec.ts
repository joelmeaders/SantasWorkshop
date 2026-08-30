import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Child } from '@santashop/models';
import {
	ageValid,
	firstNameValid,
	lastNameValid,
	validateChild,
} from './child.validators';
import { CommonForms } from './common-forms';
import {
	dateToTimestamp,
	getAgeFromDate,
	MAX_BIRTHDATE,
	MIN_BIRTHDATE,
	timestampToDate,
	yyyymmddToLocalDate,
} from './date-time';
import { deepCopy } from './methods';

describe('core helpers', () => {
	afterEach(() => vi.useRealTimers());

	it('builds shared form messages and a form builder', () => {
		expect(CommonForms.formBuilder()).toBeTruthy();
		expect(CommonForms.messages(2, 20)).toEqual({
			required: { type: 'required', message: 'This field is required' },
			minLength: {
				type: 'minlength',
				message: 'Must be between 2-20 characters',
			},
			maxLength: {
				type: 'maxlength',
				message: 'Must be between 2-20 characters',
			},
		});
	});

	it('converts dates and timestamps and parses local calendar dates', () => {
		const date = new Date('2026-12-10T12:00:00Z');
		expect(dateToTimestamp(date).toDate()).toEqual(date);
		expect(timestampToDate({ toDate: () => date } as unknown as Date)).toBe(date);
		expect(timestampToDate(date)).toBe(date);
		const local = yyyymmddToLocalDate('2026-12-15');
		expect([local.getFullYear(), local.getMonth(), local.getDate()]).toEqual([
			2026,
			11,
			15,
		]);
	});

	it('calculates age before and after the birthday', () => {
		const birthday = new Date(2010, 5, 20);
		expect(getAgeFromDate(birthday, new Date(2026, 5, 19))).toBe(15);
		expect(getAgeFromDate(birthday, new Date(2026, 5, 20))).toBe(16);
		expect(getAgeFromDate(birthday, new Date(2026, 4, 30))).toBe(15);
	});

	it('deep copies arrays, dates, nested objects, and primitives', () => {
		const source = {
			children: [{ name: 'Ada' }],
			date: new Date('2026-12-01T00:00:00Z'),
			count: 1,
		};
		const copy = deepCopy(source);

		expect(copy).toEqual(source);
		expect(copy).not.toBe(source);
		expect(copy.children).not.toBe(source.children);
		expect(copy.children[0]).not.toBe(source.children[0]);
		expect(copy.date).not.toBe(source.date);
		expect(deepCopy(null)).toBeNull();
	});

	it('validates child age and name limits without mutating the input', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 7, 1));
		const child = {
			firstName: 'Ada',
			lastName: 'Lovelace',
			dateOfBirth: new Date(2018, 0, 1),
			enabled: false,
		} as Child;

		const result = validateChild(child);
		expect(result).not.toBe(child);
		expect(result.enabled).toBe(true);
		expect(child.enabled).toBe(false);
		expect(ageValid(MIN_BIRTHDATE())).toBe(true);
		expect(ageValid(MAX_BIRTHDATE())).toBe(true);
		expect(firstNameValid('A')).toBe(false);
		expect(firstNameValid('A'.repeat(21))).toBe(false);
		expect(firstNameValid('Ada')).toBe(true);
		expect(lastNameValid('A')).toBe(false);
		expect(lastNameValid('A'.repeat(26))).toBe(false);
		expect(lastNameValid('Lovelace')).toBe(true);
	});

	it.each([
		[{ firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: new Date(2000, 0, 1) }, 'invalid_age'],
		[{ firstName: 'A', lastName: 'Lovelace', dateOfBirth: new Date(2018, 0, 1) }, 'invalid_firstname'],
		[{ firstName: 'Ada', lastName: 'L', dateOfBirth: new Date(2018, 0, 1) }, 'invalid_lastname'],
	] as const)('rejects invalid child data with %s', (input, code) => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 7, 1));
		let thrown: unknown;

		try {
			validateChild(input as Child);
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toMatchObject({ code });
	});
});
