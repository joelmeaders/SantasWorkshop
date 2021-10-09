import { Validators } from "@angular/forms";
import { IOnboardUser } from "@core/*";
import { ControlsOf, FormControl, FormGroup } from "@ngneat/reactive-forms";

const validators = {
  firstName: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
  lastName: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
  emailAddress: Validators.compose([Validators.required, Validators.minLength(5), Validators.maxLength(40), Validators.email]),
  password: Validators.compose([Validators.required, Validators.minLength(8), Validators.maxLength(40)]),
  password2: Validators.compose([Validators.required]),
  zipCode: Validators.compose([Validators.required, Validators.maxLength(5), Validators.pattern(/^\d{5}/)]),
  legal: Validators.compose([Validators.requiredTrue]),
};

export const newOnboardUserForm = (): FormGroup<ControlsOf<IOnboardUser>> => 
  new FormGroup<ControlsOf<IOnboardUser>>({
    firstName: new FormControl<string>(undefined, validators.firstName),
    lastName: new FormControl<string>(undefined, validators.lastName),
    emailAddress: new FormControl<string>(undefined, validators.emailAddress),
    password: new FormControl<string>(undefined, validators.password),
    password2: new FormControl<string>(undefined, validators.password),
    zipCode: new FormControl<number>(undefined, validators.zipCode),
    legal: new FormControl<boolean | Date>(false, validators.legal),
  });