import { describe, expect, it } from 'vitest';
import {
	calculateRegistrationStats,
	isPartialRegistrationComplete,
	isRegistrationComplete,
} from '../../../src/utility/registrations';
import { AgeGroup, ToyType } from '@santashop/models';
import { createRegistration } from '../../fixtures/factories';

describe('registrations utility', () => {
	it('returns true for a fully populated registration', () => {
		const registration = createRegistration();

		expect(isRegistrationComplete(registration)).toBe(true);
	});

	it('returns false when a required registration field is missing', () => {
		const registration = createRegistration({ dateTimeSlot: undefined });

		expect(isRegistrationComplete(registration)).toBe(false);
	});

	it('returns true for a partial registration with the minimum required fields', () => {
		const registration = createRegistration({
			firstName: undefined,
			lastName: undefined,
			emailAddress: undefined,
			dateTimeSlot: undefined,
		});

		expect(isPartialRegistrationComplete(registration)).toBe(true);
	});

	it('returns false for a partial registration missing children', () => {
		const registration = createRegistration({ children: [] });

		expect(isPartialRegistrationComplete(registration)).toBe(false);
	});

	it('calculates registration stats from the children collection', () => {
		const registration = createRegistration({
			qrcode: 'onsite',
			children: [
				{
					id: 1,
					firstName: 'Pepper',
					lastName: 'Elf',
					dateOfBirth: new Date('2024-01-10T00:00:00.000Z'),
					ageGroup: AgeGroup.age02,
					toyType: ToyType.infant,
					programYearAdded: 2025,
					enabled: true,
				},
				{
					id: 2,
					firstName: 'Jovie',
					lastName: 'Elf',
					dateOfBirth: new Date('2017-01-10T00:00:00.000Z'),
					ageGroup: AgeGroup.age68,
					toyType: ToyType.girl,
					programYearAdded: 2025,
					enabled: true,
				},
			],
		});

		const stats = calculateRegistrationStats(registration, true);

		expect(stats).toEqual({
			preregistered: false,
			children: 2,
			ageGroup02: 1,
			ageGroup35: 0,
			ageGroup68: 1,
			ageGroup911: 0,
			toyTypeInfant: 1,
			toyTypeBoy: 0,
			toyTypeGirl: 1,
			modifiedAtCheckIn: true,
			zipCode: '80205',
		});
	});
});
