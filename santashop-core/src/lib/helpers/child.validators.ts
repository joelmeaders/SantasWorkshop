import { Child, ChildValidationError } from '@santashop/models';
import {
	dateToCalendarString,
	MAX_BIRTHDATE,
	MIN_BIRTHDATE,
} from './date-time';
import { deepCopy } from './methods';

export const validateChild = (
	inputChild: Child,
	programYear = new Date().getFullYear(),
): Child => {
	const outputChild = deepCopy(inputChild);

	if (!ageValid(outputChild.dateOfBirth, programYear))
		throw new ChildValidationError('invalid_age');

	if (!firstNameValid(outputChild.firstName))
		throw new ChildValidationError('invalid_firstname');

	if (!lastNameValid(outputChild.lastName))
		throw new ChildValidationError('invalid_lastname');

	outputChild.enabled = true;

	return outputChild;
};

export const ageValid = (
	birthdate: Date,
	programYear = new Date().getFullYear(),
): boolean => {
	if (Number.isNaN(birthdate.getTime())) return false;
	const calendarBirthdate = dateToCalendarString(birthdate);
	return (
		calendarBirthdate >= dateToCalendarString(MIN_BIRTHDATE(programYear)) &&
		calendarBirthdate <= dateToCalendarString(MAX_BIRTHDATE(programYear))
	);
};

export const firstNameValid = (firstName: string): boolean => {
	const length = firstName?.length;
	return length >= 2 && length <= 20;
};

export const lastNameValid = (lastName: string): boolean => {
	const length = lastName?.length;
	return length >= 2 && length <= 25;
};
