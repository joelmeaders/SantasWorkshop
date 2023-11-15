import { Child, ChildValidationError } from "@santashop/models";
import { MAX_BIRTHDATE, MIN_BIRTHDATE } from "./date-time";
import { deepCopy } from "./methods";

export const validateChild = (inputChild: Child): Child => {
    const outputChild = deepCopy(inputChild);

    if (!ageValid(outputChild.dateOfBirth))
        throw new ChildValidationError('invalid_age');

    if (!firstNameValid(outputChild.firstName))
        throw new ChildValidationError('invalid_firstname');

    if (!lastNameValid(outputChild.lastName))
        throw new ChildValidationError('invalid_lastname');

    outputChild.enabled = true;

    return outputChild;
}

export const ageValid = (birthdate: Date): boolean => {
    return birthdate >= MIN_BIRTHDATE() && birthdate <= MAX_BIRTHDATE();
}

export const firstNameValid = (firstName: string): boolean => {
    const length = firstName?.length;
    return length >= 2 && length <= 20;
}

export const lastNameValid = (lastName: string): boolean => {
    const length = lastName?.length;
    return length >= 2 && length <= 25;
}