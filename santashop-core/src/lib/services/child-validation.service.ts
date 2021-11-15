import { Injectable } from '@angular/core';
import { MAX_BIRTHDATE } from '@core/*';
import { ChildValidationError, IChild } from '@models/*';
import { deepCopy } from '../helpers/methods';
import { MIN_BIRTHDATE } from '../parameters';

@Injectable()
export class ChildValidationService {

  public validateChild(inputChild: IChild): IChild {
    const outputChild = deepCopy(inputChild);
  
    if (!this.ageValid(outputChild.dateOfBirth))
      throw new ChildValidationError("invalid_age"); 

    if (!this.firstNameValid(outputChild.firstName))
      throw new ChildValidationError("invalid_firstname"); 

    if (!this.lastNameValid(outputChild.lastName))
      throw new ChildValidationError("invalid_lastname"); 

    outputChild.enabled = true;

    return outputChild;
  }

  private ageValid(birthdate: Date): boolean {
    return birthdate >= MIN_BIRTHDATE() && birthdate <= MAX_BIRTHDATE();
  }

  private firstNameValid(firstName: string): boolean {
    const length = firstName?.length;
    return length >= 2 && length <= 20;
  }

  private lastNameValid(lastName: string): boolean {
    const length = lastName?.length;
    return length >= 2 && length <= 25;
  }
}
