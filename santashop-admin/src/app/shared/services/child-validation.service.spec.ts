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
		// Arrange - For 2025: ages 0-12 are valid (born 2013-2025)
		const ageZero = new Date('12/15/2025'); // Born in 2025, age 0
		const age12 = new Date('12/15/2013'); // Born in 2013, age 12
		const age13 = new Date('12/15/2012'); // Born in 2012, age 13 - TOO OLD
		const futureDate = new Date('1/1/2026'); // Future date - INVALID

		// Act & Assert - Valid ages
		expect(service.ageValid(ageZero)).toBeTrue();
		expect(service.ageValid(age12)).toBeTrue();

		// Act & Assert - Invalid ages
		expect(service.ageValid(futureDate)).toBeFalse();
		expect(service.ageValid(age13)).toBeFalse();
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
		expect(shouldBeTrue).toBeTrue();
		expect(shouldBefalse).toBeFalse();
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
		expect(shouldBeTrue).toBeTrue();
		expect(shouldBefalse).toBeFalse();
	});

	it('validateChild(): should make expected calls and return valid child', () => {
		// Arrange
		const validChild: Child = {
			firstName: 'Josh',
			lastName: 'Henrison',
			dateOfBirth: new Date('6/17/2018'),
			enabled: false,
		};

		const ageValidSpy = spyOn(service, 'ageValid');
		ageValidSpy.and.callThrough();

		const firstNameValidSpy = spyOn(service, 'firstNameValid');
		firstNameValidSpy.and.callThrough();

		const lastNameValidSpy = spyOn(service, 'lastNameValid');
		lastNameValidSpy.and.callThrough();

		// Act
		const result = service.validateChild(validChild);

		// Assert
		expect(ageValidSpy).toHaveBeenCalledOnceWith(validChild.dateOfBirth);
		expect(firstNameValidSpy).toHaveBeenCalledOnceWith('Josh');
		expect(lastNameValidSpy).toHaveBeenCalledOnceWith('Henrison');
		expect(result).toBeTruthy();
		expect(result.firstName).toEqual(validChild.firstName);
		expect(result.lastName).toEqual(validChild.lastName);
		expect(result.dateOfBirth).toEqual(validChild.dateOfBirth);
		expect(result.enabled).toBeTrue();
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
			dateOfBirth: new Date('6/17/1918'),
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
			dateOfBirth: new Date('6/17/1918'),
			enabled: false,
		};

		// Act
		const result = (): Child => service.validateChild(child);

		// Assert
		expect(result).toThrow(new ChildValidationError('invalid_lastname'));
	});

	it('MAX_BIRTHDATE: should be expected value', () => {
		expect(MAX_BIRTHDATE().toDateString()).toEqual(
			new Date('12/31/2025').toDateString(),
		);
	});

	it('MAX_CHILD_AGE_IN_YEARS: should be expected value', () => {
		expect(MAX_CHILD_AGE_IN_YEARS()).toEqual(12);
	});

	it('MIN_BIRTHDATE: should be expected value', () => {
		expect(MIN_BIRTHDATE().toDateString()).toEqual(
			new Date('1/1/2013').toDateString(),
		);
	});
});
