import { Validators } from "@angular/forms";
import { AgeGroup, IChild, ToyType } from "@core/*";
import { FormControl, FormGroup } from "@ngneat/reactive-forms";

// TECHDEBT: This inheritence fixes an issue with strict templates
// and optional parameters caused by @ngneat/reactive-forms
export interface IChildForm extends IChild {
  id: number;
  ageGroup: AgeGroup;
  toyType: ToyType;
  programYearAdded: number;
}

const validators = {
  firstName: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
  lastName: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
  dateOfBirth: Validators.compose([Validators.required, Validators.pattern(/20\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])/)]),
  ageGroup: Validators.compose([Validators.required]),
  toyType: Validators.compose([Validators.required]),
  programYearAdded: Validators.compose([Validators.required, Validators.maxLength(4), Validators.pattern(/^\d{4}/)]),
  enabled: Validators.compose([Validators.requiredTrue]),
};

export const newChildForm = (programYear: number): FormGroup<IChildForm> => 
  new FormGroup<IChildForm>({
    id: new FormControl<number>(Math.floor(Math.random() * 100000)), // Random child id
    firstName: new FormControl<string>(undefined, validators.firstName),
    lastName: new FormControl<string>(undefined, validators.lastName),
    dateOfBirth: new FormControl<Date>(undefined, validators.dateOfBirth),
    ageGroup: new FormControl<AgeGroup>(undefined, validators.ageGroup),
    toyType: new FormControl<ToyType>(undefined, validators.toyType),
    programYearAdded: new FormControl<number>(programYear, validators.programYearAdded),
    enabled: new FormControl<boolean>(true, validators.enabled)
  });