import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChildValidationError, Child } from '@santashop/models';
import { PROGRAM_YEAR } from '@santashop/core/admin/firestore';
import {
	ChildValidationService,
	MAX_CHILD_AGE_IN_YEARS,
} from './child-validation.service';

describe('ChildValidationService', () => {
	const configuredProgramYear = 2030;
	let service: ChildValidationService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				{ provide: ChildValidationService },
				{ provide: PROGRAM_YEAR, useValue: configuredProgramYear },
			],
		});
		service = TestBed.inject(ChildValidationService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('ageValid(): should return expected results', () => {
		const programYear = configuredProgramYear;
		const ageZero = new Date(programYear, 11, 15);
		const age11 = new Date(programYear - 11, 0, 1);
		const age12 = new Date(programYear - 12, 11, 31);
		const futureDate = new Date(programYear + 1, 0, 1);

		// Act & Assert - Valid ages
		expect(service.ageValid(ageZero)).toBe(true);
		expect(service.ageValid(age11)).toBe(true);
		expect(
			service.ageValid(new Date(Date.UTC(programYear - 11, 0, 1))),
		).toBe(true);

		// Act & Assert - Invalid ages
		expect(service.ageValid(futureDate)).toBe(false);
		expect(service.ageValid(age12)).toBe(false);
		expect(service.ageValid(new Date(Number.NaN))).toBe(false);
	});

	it('firstNameValid(): should return expected results', () => {
		// Arrange
		const tooShort = 'a';
		const minimumLength = 'Al';
		const maximumLength = 'a'.repeat(20);
		const tooLong = 'a'.repeat(21);
		const justRight = 'Emily';

		// Assert
		expect(service.firstNameValid(tooShort)).toBe(false);
		expect(service.firstNameValid(minimumLength)).toBe(true);
		expect(service.firstNameValid(maximumLength)).toBe(true);
		expect(service.firstNameValid(tooLong)).toBe(false);
		expect(service.firstNameValid(justRight)).toBe(true);
	});

	it('lastNameValid(): should return expected results', () => {
		// Arrange
		const tooShort = 'a';
		const minimumLength = 'Li';
		const maximumLength = 'a'.repeat(25);
		const tooLong = 'a'.repeat(26);
		const justRight = 'Lattenshire';

		// Assert
		expect(service.lastNameValid(tooShort)).toBe(false);
		expect(service.lastNameValid(minimumLength)).toBe(true);
		expect(service.lastNameValid(maximumLength)).toBe(true);
		expect(service.lastNameValid(tooLong)).toBe(false);
		expect(service.lastNameValid(justRight)).toBe(true);
	});

	it('validateChild(): should make expected calls and return valid child', () => {
		// Arrange
		const validChild: Child = {
			firstName: 'Josh',
			lastName: 'Henrison',
			dateOfBirth: new Date(configuredProgramYear - 5, 5, 17),
			enabled: false,
		};

		const ageValidSpy = vi
			.spyOn(service, 'ageValid')
			.mockReturnValue(true);

		const firstNameValidSpy = vi
			.spyOn(service, 'firstNameValid')
			.mockReturnValue(true);

		const lastNameValidSpy = vi
			.spyOn(service, 'lastNameValid')
			.mockReturnValue(true);

		// Act
		const result = service.validateChild(validChild);

		// Assert
		expect(ageValidSpy).toHaveBeenCalledTimes(1);

		// Assert
		expect(ageValidSpy).toHaveBeenCalledWith(validChild.dateOfBirth);
		expect(firstNameValidSpy).toHaveBeenCalledTimes(1);
		expect(firstNameValidSpy).toHaveBeenCalledWith('Josh');
		expect(lastNameValidSpy).toHaveBeenCalledTimes(1);
		expect(lastNameValidSpy).toHaveBeenCalledWith('Henrison');
		expect(result).toBeTruthy();
		expect(result.firstName).toEqual(validChild.firstName);
		expect(result.lastName).toEqual(validChild.lastName);
		expect(result.dateOfBirth).toEqual(validChild.dateOfBirth);
		expect(result.enabled).toBe(true);
	});

	it('validateChild(): should throw invalid_age error', () => {
		// Arrange
		const child: Child = {
			firstName: 'Josh',
			lastName: 'Henrison',
			dateOfBirth: new Date('6/17/1918'),
			enabled: false,
		};

		// Act
		const result = (): Child => service.validateChild(child);

		// Assert
		expect(result).toThrow(new ChildValidationError('invalid_age'));
	});

	it('validateChild(): should throw invalid_firstname error', () => {
		// Arrange
		const child: Child = {
			firstName: 'J',
			lastName: 'Henrison',
			dateOfBirth: new Date(configuredProgramYear - 5, 5, 17),
			enabled: false,
		};

		// Act
		const result = (): Child => service.validateChild(child);

		// Assert
		expect(result).toThrow(new ChildValidationError('invalid_firstname'));
	});

	it('validateChild(): should throw invalid_lastname error', () => {
		// Arrange
		const child: Child = {
			firstName: 'Josh',
			lastName: 'H',
			dateOfBirth: new Date(configuredProgramYear - 5, 5, 17),
			enabled: false,
		};

		// Act
		const result = (): Child => service.validateChild(child);

		// Assert
		expect(result).toThrow(new ChildValidationError('invalid_lastname'));
	});

	it('MAX_BIRTHDATE: should be expected value', () => {
		expect(service.maxBirthDate().toDateString()).toEqual(
			new Date(configuredProgramYear, 11, 31).toDateString(),
		);
	});

	it('MAX_CHILD_AGE_IN_YEARS: should be expected value', () => {
		expect(MAX_CHILD_AGE_IN_YEARS()).toEqual(11);
	});

	it('MIN_BIRTHDATE: should be expected value', () => {
		const expectedYear = configuredProgramYear - MAX_CHILD_AGE_IN_YEARS();
		expect(service.minBirthDate().toDateString()).toEqual(
			new Date(expectedYear, 0, 1).toDateString(),
		);
	});
});
