import { Injectable } from '@angular/core';
import { ChildValidationError, Child } from '@santashop/models';
import { deepCopy } from '@santashop/core';

// TODO: Injectable tokens
export const MAX_BIRTHDATE = (): Date => new Date('12/31/2025');

export const MAX_CHILD_AGE_IN_YEARS = (): number => 12;

export const MIN_BIRTHDATE = (): Date => {
	const maxDate = MAX_BIRTHDATE();
	const year = maxDate.getFullYear() - MAX_CHILD_AGE_IN_YEARS();
	return new Date(`1/1/${year}`);
};

@Injectable({
	providedIn: 'root',
})
export class ChildValidationService {
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
		return birthdate <= MAX_BIRTHDATE() && birthdate >= MIN_BIRTHDATE();
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
