import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChildValidationError, Child } from '@santashop/models';
import {
	ChildValidationService,
	MAX_BIRTHDATE,
	MAX_CHILD_AGE_IN_YEARS,
	MIN_BIRTHDATE,
} from './child-validation.service';

describe('ChildValidationService', () => {
	let service: ChildValidationService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [{ provide: ChildValidationService }],
		});
		service = TestBed.inject(ChildValidationService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('ageValid(): should return expected results', () => {
		const programYear = new Date().getFullYear();
		const ageZero = new Date(programYear, 11, 15);
		const age12 = new Date(programYear - MAX_CHILD_AGE_IN_YEARS(), 11, 15);
		const age13 = new Date(
			programYear - MAX_CHILD_AGE_IN_YEARS() - 1,
			11,
			15,
		);
		const futureDate = new Date(programYear + 1, 0, 1);

		// Act & Assert - Valid ages
		expect(service.ageValid(ageZero)).toBe(true);
		expect(service.ageValid(age12)).toBe(true);

		// Act & Assert - Invalid ages
		expect(service.ageValid(futureDate)).toBe(false);
		expect(service.ageValid(age13)).toBe(false);
	});

	it('firstNameValid(): should return expected results', () => {
		// Arrange
		const tooShort = 'a';
		const tooLong = 'iuerhvbosdnckdfn.lanvkudfnvlsnvkludfnv;lksndkludfgnb';
		const justRight = 'Emily';

		// Act
		const shouldBefalse =
			service.firstNameValid(tooShort) && service.firstNameValid(tooLong);
		const shouldBeTrue = service.firstNameValid(justRight);

		// Assert
		expect(shouldBeTrue).toBe(true);
		expect(shouldBefalse).toBe(false);
	});

	it('lastNameValid(): should return expected results', () => {
		// Arrange
		const tooShort = 'a';
		const tooLong = 'iuerhvbosdnckdfn.lanvkudfnvlsnvkludfnv;lksndkludfgnb';
		const justRight = 'Lattenshire';

		// Act
		const shouldBefalse =
			service.firstNameValid(tooShort) && service.firstNameValid(tooLong);
		const shouldBeTrue = service.firstNameValid(justRight);

		// Assert
		expect(shouldBeTrue).toBe(true);
		expect(shouldBefalse).toBe(false);
	});

	it('validateChild(): should make expected calls and return valid child', () => {
		// Arrange
		const validChild: Child = {
			firstName: 'Josh',
			lastName: 'Henrison',
			dateOfBirth: new Date('6/17/2018'),
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
			dateOfBirth: new Date('6/17/2018'),
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
			dateOfBirth: new Date('6/17/2018'),
			enabled: false,
		};

		// Act
		const result = (): Child => service.validateChild(child);

		// Assert
		expect(result).toThrow(new ChildValidationError('invalid_lastname'));
	});

	it('MAX_BIRTHDATE: should be expected value', () => {
		expect(MAX_BIRTHDATE().toDateString()).toEqual(
			new Date(new Date().getFullYear(), 11, 31).toDateString(),
		);
	});

	it('MAX_CHILD_AGE_IN_YEARS: should be expected value', () => {
		expect(MAX_CHILD_AGE_IN_YEARS()).toEqual(12);
	});

	it('MIN_BIRTHDATE: should be expected value', () => {
		const expectedYear =
			new Date().getFullYear() - MAX_CHILD_AGE_IN_YEARS();
		expect(MIN_BIRTHDATE().toDateString()).toEqual(
			new Date(`1/1/${expectedYear}`).toDateString(),
		);
	});
});
