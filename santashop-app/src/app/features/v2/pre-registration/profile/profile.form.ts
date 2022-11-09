import { Validators } from '@angular/forms';
import { FormControl, FormGroup } from '@ngneat/reactive-forms';

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

export const changeEmailForm = (): FormGroup<{
	password: FormControl<string>;
	emailAddress: FormControl<string>;
}> =>
	new FormGroup({
		password: new FormControl<string>(undefined, Validators.required),
		emailAddress: new FormControl<string>(
			undefined,
			validators.emailAddress
		),
	});

export const changePasswordForm = (): FormGroup<{
	oldPassword: FormControl<string>;
	newPassword: FormControl<string>;
	newPassword2: FormControl<string>;
}> =>
	new FormGroup({
		oldPassword: new FormControl<string>(undefined, Validators.required),
		newPassword: new FormControl<string>(undefined, validators.password),
		newPassword2: new FormControl<string>(undefined, validators.password),
	});
