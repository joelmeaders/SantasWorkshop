import { TestBed } from '@angular/core/testing';
import { ChildValidationError, IChild } from '@models/*';
import { ChildValidationService, MAX_BIRTHDATE, MAX_CHILD_AGE_IN_YEARS, MIN_BIRTHDATE } from './child-validation.service';

describe('ChildValidationService', () => {
  let service: ChildValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ 
      teardown: { destroyAfterEach: false },
      providers: [
        { provide: ChildValidationService }
      ]
    });
    service = TestBed.inject(ChildValidationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('ageValid(): should return expected results', () => {
    // Arrange
    const ageZero = new Date('12/15/2021');
    const age12 = new Date('12/15/2021');
    const age13 = new Date('12/15/2021');
    const negativeAge = new Date('1/1/2022');

    // Act
    const shouldBeTrue = service.ageValid(ageZero) && service.ageValid(age12);
    const shouldBefalse = service.ageValid(negativeAge) && service.ageValid(age13);

    // Assert
    expect(shouldBeTrue).toBeTrue();
    expect(shouldBefalse).toBeFalse();
  });

  it('firstNameValid(): should return expected results', () => {
    // Arrange
    const tooShort = 'a';
    const tooLong = 'iuerhvbosdnckdfn.lanvkudfnvlsnvkludfnv;lksndkludfgnb';
    const justRight = 'Emily';

    // Act
    const shouldBefalse = service.firstNameValid(tooShort) && service.firstNameValid(tooLong);
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
    const shouldBefalse = service.firstNameValid(tooShort) && service.firstNameValid(tooLong);
    const shouldBeTrue = service.firstNameValid(justRight);

    // Assert
    expect(shouldBeTrue).toBeTrue();
    expect(shouldBefalse).toBeFalse();
  });

  it('validateChild(): should make expected calls and return valid child', () => {
    // Arrange
    const validChild: IChild = {
      firstName: 'Josh',
      lastName: 'Henrison',
      dateOfBirth: new Date('6/17/2018'),
      enabled: false
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
    const child: IChild = {
      firstName: 'Josh',
      lastName: 'Henrison',
      dateOfBirth: new Date('6/17/1918'),
      enabled: false
    };

    // Act
    const result = () => service.validateChild(child);

    // Assert
    expect(result).toThrow(new ChildValidationError("invalid_age"));
  });

  it('validateChild(): should throw invalid_firstname error', () => {
    // Arrange
    const child: IChild = {
      firstName: 'J',
      lastName: 'Henrison',
      dateOfBirth: new Date('6/17/1918'),
      enabled: false
    };

    // Act
    const result = () => service.validateChild(child);

    // Assert
    expect(result).toThrow(new ChildValidationError("invalid_firstname"));
  });

  it('validateChild(): should throw invalid_lastname error', () => {
    // Arrange
    const child: IChild = {
      firstName: 'Josh',
      lastName: 'H',
      dateOfBirth: new Date('6/17/1918'),
      enabled: false
    };

    // Act
    const result = () => service.validateChild(child);

    // Assert
    expect(result).toThrow(new ChildValidationError("invalid_lastname"));
  });

  it('MAX_BIRTHDATE: should be expected value', () => {
    expect(MAX_BIRTHDATE().toDateString()).toEqual(new Date('12/31/2021').toDateString());
  });

  it('MAX_CHILD_AGE_IN_YEARS: should be expected value', () => {
    expect(MAX_CHILD_AGE_IN_YEARS()).toEqual(12);
  });

  it('MIN_BIRTHDATE: should be expected value', () => {
    expect(MIN_BIRTHDATE().toDateString()).toEqual(new Date('12/31/2009').toDateString());
  });

});
