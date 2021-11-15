import { Validators } from '@angular/forms';
import { IAuth } from '@models/*';
import { ControlsOf, FormControl, FormGroup } from '@ngneat/reactive-forms';

const validators = {
  emailAddress: Validators.compose([Validators.required, Validators.minLength(5), Validators.maxLength(40), Validators.email]),
  password: Validators.compose([Validators.required, Validators.minLength(8), Validators.maxLength(40)]),
};

export const newAuthForm = (): FormGroup<ControlsOf<IAuth>> =>
  new FormGroup<ControlsOf<IAuth>>({
    emailAddress: new FormControl<string>(undefined, validators.emailAddress),
    password: new FormControl<string>(undefined, validators.password)
  });