import { FormControl, FormGroup, Validators } from '@angular/forms';

export interface ChangeUserInfoForm {
	firstName: FormControl<string | undefined>;
	lastName: FormControl<string | undefined>;
	zipCode: FormControl<number | undefined>;
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
	zipCode: Validators.compose([
		Validators.required,
		Validators.maxLength(5),
		Validators.pattern(/^\d{5}/),
	]),
};

export const newChangeInfoForm = (): FormGroup<ChangeUserInfoForm> =>
	new FormGroup<ChangeUserInfoForm>({
		firstName: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.firstName,
		}),
		lastName: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.lastName,
		}),
		zipCode: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.zipCode,
		}),
	});
