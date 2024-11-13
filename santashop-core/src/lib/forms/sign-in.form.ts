import { FormControl, FormGroup, Validators } from '@angular/forms';

export interface SignInForm {
	emailAddress: FormControl<string | undefined>;
	password: FormControl<string | undefined>;
}

const validators = {
	emailAddress: Validators.compose([
		Validators.required,
		Validators.minLength(5),
		Validators.maxLength(40),
		Validators.email,
	]),
	password: Validators.compose([
		Validators.required,
		Validators.minLength(8),
		Validators.maxLength(40),
	]),
};

export const newAuthForm = (): FormGroup<SignInForm> =>
	new FormGroup<SignInForm>({
		emailAddress: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.emailAddress,
		}),
		password: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.password,
		}),
	});
