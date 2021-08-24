import { Validators } from '@angular/forms';
import { FormControl, FormGroup } from '@ngneat/reactive-forms';
import { IAuth } from '../models/auth.model';

const validators = {
  emailAddress: Validators.compose([Validators.required, Validators.minLength(5), Validators.maxLength(40), Validators.email]),
  password: Validators.compose([Validators.required, Validators.minLength(8), Validators.maxLength(40)]),
};

export const newAuthForm = (): FormGroup<IAuth> =>
  new FormGroup<IAuth>({
    emailAddress: new FormControl<string>(undefined, validators.emailAddress),
    password: new FormControl<string>(undefined, validators.password)
  });