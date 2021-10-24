import { Validators } from '@angular/forms';
import { IOnboardUser } from '@core/*';
import { ControlsOf, FormControl, FormGroup } from '@ngneat/reactive-forms';

const validators = {
  firstName: Validators.compose([
    Validators.required,
    Validators.minLength(2),
    Validators.maxLength(25),
  ]),
  lastName: Validators.compose([
    Validators.required,
    Validators.minLength(2),
    Validators.maxLength(25),
  ]),
  emailAddress: Validators.compose([
    Validators.required,
    Validators.minLength(5), // TODO: Increase this value in all places where copy/pasted
    Validators.maxLength(40),
    Validators.email,
  ]),
  zipCode: Validators.compose([
    Validators.required,
    Validators.maxLength(5),
    Validators.pattern(/^\d{5}/),
  ]),
  password: Validators.compose([
    Validators.required,
    Validators.minLength(8),
    Validators.maxLength(40),
  ]),
};

export const editProfileForm = () => new FormGroup<ControlsOf<Partial<IOnboardUser>>>({
  firstName: new FormControl<string>('', validators.firstName),
  lastName: new FormControl<string>('', validators.lastName),
  zipCode: new FormControl<number>(undefined, validators.zipCode)
});

export const changeEmailForm = () => new FormGroup(
  {
    password: new FormControl<string>(undefined, Validators.required),
    oldEmailAddress: new FormControl<string>(undefined, validators.emailAddress),
    newEmailAddress: new FormControl<string>(undefined, validators.emailAddress)
  }
);

export const changePasswordForm = () => new FormGroup(
  {
    oldPassword: new FormControl<string>(undefined, Validators.required),
    newPassword: new FormControl<string>(undefined, validators.password),
    newPassword2: new FormControl<string>(undefined, validators.password)
  }
);
