import { Injectable, inject } from '@angular/core';
import { ChildValidationError, Child } from '@santashop/models';
import {
	dateToCalendarString,
	deepCopy,
	PROGRAM_YEAR,
} from '@santashop/core/admin/firestore';

export const MAX_BIRTHDATE = (
	programYear = new Date().getFullYear(),
): Date => new Date(programYear, 11, 31);

export const MAX_CHILD_AGE_IN_YEARS = (): number => 11;

export const MIN_BIRTHDATE = (
	programYear = new Date().getFullYear(),
): Date => {
	const maxDate = MAX_BIRTHDATE(programYear);
	const year = maxDate.getFullYear() - MAX_CHILD_AGE_IN_YEARS();
	return new Date(year, 0, 1);
};

@Injectable({
	providedIn: 'root',
})
export class ChildValidationService {
	private readonly programYear =
		inject(PROGRAM_YEAR, { optional: true }) ?? new Date().getFullYear();

	public minBirthDate(): Date {
		return MIN_BIRTHDATE(this.programYear);
	}

	public maxBirthDate(): Date {
		return MAX_BIRTHDATE(this.programYear);
	}

	public validateChild(inputChild: Child): Child {
		const outputChild = deepCopy(inputChild);

		if (!this.ageValid(outputChild.dateOfBirth))
			throw new ChildValidationError('invalid_age');

		if (!this.firstNameValid(outputChild.firstName))
			throw new ChildValidationError('invalid_firstname');

		if (!this.lastNameValid(outputChild.lastName))
			throw new ChildValidationError('invalid_lastname');

		outputChild.enabled = true;

		return outputChild;
	}

	public ageValid(birthdate: Date): boolean {
		if (Number.isNaN(birthdate.getTime())) return false;
		const calendarBirthdate = dateToCalendarString(birthdate);
		return (
			calendarBirthdate <= dateToCalendarString(this.maxBirthDate()) &&
			calendarBirthdate >= dateToCalendarString(this.minBirthDate())
		);
	}

	public firstNameValid(firstName: string): boolean {
		const length = firstName?.length;
		return length >= 2 && length <= 20;
	}

	public lastNameValid(lastName: string): boolean {
		const length = lastName?.length;
		return length >= 2 && length <= 25;
	}
}
