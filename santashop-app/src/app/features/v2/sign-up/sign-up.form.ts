import { FormControl, FormGroup, Validators } from '@angular/forms';

export interface OnboardUserForm {
	firstName: FormControl<string | undefined>;
	lastName: FormControl<string | undefined>;
	emailAddress: FormControl<string | undefined>;
	password: FormControl<string | undefined>;
	password2: FormControl<string | undefined>;
	zipCode: FormControl<number | undefined>;
	legal: FormControl<boolean | Date | undefined>;
	newsletter: FormControl<boolean | undefined>;
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
		Validators.maxLength(40),
		Validators.email,
	]),
	password: Validators.compose([
		Validators.required,
		Validators.minLength(8),
		Validators.maxLength(40),
	]),
	zipCode: Validators.compose([
		Validators.required,
		Validators.maxLength(5),
		Validators.pattern(/^\d{5}/),
	]),
	legal: Validators.compose([Validators.requiredTrue]),
};

export const newOnboardUserForm = (): FormGroup<OnboardUserForm> =>
	new FormGroup<OnboardUserForm>(
		{
			firstName: new FormControl(undefined, {
				nonNullable: true,
				validators: validators.firstName,
			}),
			lastName: new FormControl(undefined, {
				nonNullable: true,
				validators: validators.lastName,
			}),
			emailAddress: new FormControl(undefined, {
				nonNullable: true,
				validators: validators.emailAddress,
			}),
			password: new FormControl(undefined, {
				nonNullable: true,
				validators: validators.password,
			}),
			password2: new FormControl(undefined, {
				nonNullable: true,
				validators: validators.password,
			}),
			zipCode: new FormControl(undefined, {
				nonNullable: true,
				validators: validators.zipCode,
			}),
			legal: new FormControl(false, {
				nonNullable: true,
				validators: validators.legal,
			}),
			newsletter: new FormControl(false, {
				nonNullable: true,
			}),
		},
		{
			validators: passwordMatchValidator,
		},
	);

function passwordMatchValidator(
	formGroup: any,
): { passwordMismatch: boolean } | null {
	if (
		!formGroup.controls.password.value ||
		!formGroup.controls.password2.value
	) {
		return null;
	}

	return formGroup.controls.password.value ===
		formGroup.controls.password2.value
		? null
		: { passwordMismatch: true };
}
