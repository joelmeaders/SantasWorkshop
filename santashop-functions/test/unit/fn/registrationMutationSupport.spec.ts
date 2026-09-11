import { describe, expect, it } from 'vitest';
import { ToyType } from '@santashop/models';
import {
	canonicalizeChild,
	getStoredMutationResult,
	requireEnabledCurrentSlot,
	requireMutationId,
	requireObject,
	requireOpenPreRegistration,
} from '../../../src/fn/registrationMutationSupport';
import { PROGRAM_YEAR } from '../../../src/utility/runtime-config';

describe('registration mutation support', () => {
	it('rejects malformed request envelopes and mutation IDs', () => {
		expect(() => requireObject([])).toThrow(
			/Request data must be an object/,
		);
		expect(() => requireMutationId('short')).toThrow(
			/Mutation ID must contain/,
		);
		expect(() => requireOpenPreRegistration(undefined)).toThrow(
			/Pre-registration is currently unavailable/,
		);
	});

	it('rejects a reused mutation ID for a different operation', () => {
		expect(() =>
			getStoredMutationResult(
				{
					operation: 'saveDraftChild',
					result: true,
					completedOn: new Date(),
				},
				'undoRegistration',
			),
		).toThrow(/already used for a different operation/);
	});

	it('canonicalizes children and applies age-appropriate toy validation', () => {
		const child = canonicalizeChild({
			id: 2,
			firstName: ' Noelle ',
			lastName: ' Elf ',
			dateOfBirth: new Date(PROGRAM_YEAR - 5, 5, 10),
			toyType: ToyType.girl,
		});
		expect(child).toMatchObject({
			id: 2,
			firstName: 'Noelle',
			lastName: 'Elf',
			toyType: ToyType.girl,
		});
		expect(() =>
			canonicalizeChild({
				id: 3,
				firstName: 'Baby',
				lastName: 'Elf',
				dateOfBirth: new Date(PROGRAM_YEAR - 1, 5, 10),
				toyType: ToyType.girl,
			}),
		).toThrow(/Infant children must use the infant toy type/);
	});

	it('accepts age 11 and rejects age 12 at the program-year cutoff', () => {
		const eligibleChild = canonicalizeChild({
			id: 4,
			firstName: 'Older',
			lastName: 'Elf',
			dateOfBirth: new Date(PROGRAM_YEAR - 11, 0, 1),
			toyType: ToyType.girl,
		});

		expect(eligibleChild.ageGroup).toBe('9-11');
		expect(() =>
			canonicalizeChild({
				id: 5,
				firstName: 'Too Old',
				lastName: 'Elf',
				dateOfBirth: new Date(PROGRAM_YEAR - 12, 11, 31),
				toyType: ToyType.girl,
			}),
		).toThrow(/eligible age range/);
	});

	it('normalizes date-only and event-time birth dates to UTC calendar dates', () => {
		const expectedDate = new Date(`${PROGRAM_YEAR}-12-31T00:00:00.000Z`);
		const dateOnlyChild = canonicalizeChild({
			id: 6,
			firstName: 'New',
			lastName: 'Year',
			dateOfBirth: `${PROGRAM_YEAR}-12-31`,
			toyType: ToyType.infant,
		});
		const legacyDateChild = canonicalizeChild({
			id: 7,
			firstName: 'New',
			lastName: 'Year',
			dateOfBirth: new Date(`${PROGRAM_YEAR}-12-31T07:00:00.000Z`),
			toyType: ToyType.infant,
		});
		const legacyTimestampChild = canonicalizeChild({
			id: 8,
			firstName: 'New',
			lastName: 'Year',
			dateOfBirth: {
				toDate: () => new Date(`${PROGRAM_YEAR}-12-31T07:00:00.000Z`),
			},
			toyType: ToyType.infant,
		});

		expect(dateOnlyChild.dateOfBirth).toEqual(expectedDate);
		expect(legacyDateChild.dateOfBirth).toEqual(expectedDate);
		expect(legacyTimestampChild.dateOfBirth).toEqual(expectedDate);
	});

	it('rejects an overflowing date-only birth date', () => {
		expect(() =>
			canonicalizeChild({
				id: 9,
				firstName: 'Invalid',
				lastName: 'Date',
				dateOfBirth: `${PROGRAM_YEAR}-02-30`,
				toyType: ToyType.girl,
			}),
		).toThrow(/valid date/);
	});

	it('requires a current enabled appointment slot', () => {
		expect(() =>
			requireEnabledCurrentSlot(
				undefined,
				'slot',
				new Date('2025-12-01'),
			),
		).toThrow(/no longer exists/);
		expect(() =>
			requireEnabledCurrentSlot(
				{ id: 'slot', programYear: 2020, enabled: false } as never,
				'slot',
				new Date('2025-12-01'),
			),
		).toThrow(/no longer available/);
		expect(() =>
			requireEnabledCurrentSlot(
				{ id: 'slot', programYear: 2025, enabled: true } as never,
				'slot',
			),
		).toThrow(/no longer available/);
	});
});
