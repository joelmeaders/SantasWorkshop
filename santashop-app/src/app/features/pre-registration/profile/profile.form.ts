import { FormControl, FormGroup, Validators } from '@angular/forms';

export interface ChangeEmailForm {
	password: FormControl<string | undefined>;
	emailAddress: FormControl<string | undefined>;
}

export interface ChangePasswordForm {
	oldPassword: FormControl<string | undefined>;
	newPassword: FormControl<string | undefined>;
}

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
		Validators.minLength(5),
		Validators.maxLength(254),
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

export const changeEmailForm = (): FormGroup<ChangeEmailForm> =>
	new FormGroup<ChangeEmailForm>({
		password: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.password,
		}),
		emailAddress: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.emailAddress,
		}),
	});

export const changePasswordForm = (): FormGroup<ChangePasswordForm> =>
	new FormGroup<ChangePasswordForm>({
		oldPassword: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.password,
		}),
		newPassword: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.password,
		}),
	});
