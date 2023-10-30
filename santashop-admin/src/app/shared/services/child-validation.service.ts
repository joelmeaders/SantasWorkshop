import { Injectable } from '@angular/core';
import { ChildValidationError, Child } from '@santashop/models';
import { deepCopy } from '../../../../../santashop-core/src/lib/helpers/methods';

// TODO: Injectable tokens
export const MAX_BIRTHDATE = (): Date => new Date('12/31/2023');

export const MAX_CHILD_AGE_IN_YEARS = (): number => 12;

export const MIN_BIRTHDATE = (): Date =>
	new Date(
		MAX_BIRTHDATE().setFullYear(
			MAX_BIRTHDATE().getFullYear() - MAX_CHILD_AGE_IN_YEARS(),
		),
	);

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
		return birthdate >= MIN_BIRTHDATE() && birthdate <= MAX_BIRTHDATE();
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
