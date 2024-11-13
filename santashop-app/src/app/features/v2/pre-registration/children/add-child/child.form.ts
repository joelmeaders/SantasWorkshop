import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AgeGroup, ToyType } from '@santashop/models';

export interface ChildForm {
	id: FormControl<number>; // Random child id
	firstName: FormControl<string | undefined>;
	lastName: FormControl<string | undefined>;
	dateOfBirth: FormControl<Date | undefined>;
	ageGroup: FormControl<AgeGroup | undefined>;
	toyType: FormControl<ToyType | undefined>;
	programYearAdded: FormControl<number>;
	enabled: FormControl<boolean>;
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
	dateOfBirth: Validators.compose([
		Validators.required,
		Validators.pattern(
			/20\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][/\d]|3[01])/,
		),
	]),
	ageGroup: Validators.compose([Validators.required]),
	toyType: Validators.compose([Validators.required]),
	programYearAdded: Validators.compose([
		Validators.required,
		Validators.maxLength(4),
		Validators.pattern(/^\d{4}/),
	]),
	enabled: Validators.compose([Validators.requiredTrue]),
};

export const newChildForm = (programYear: number): FormGroup<ChildForm> =>
	new FormGroup<ChildForm>({
		id: new FormControl(Math.floor(Math.random() * 100000), {
			nonNullable: true,
		}), // Random child id
		firstName: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.firstName,
		}),
		lastName: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.lastName,
		}),
		dateOfBirth: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.dateOfBirth,
		}),
		ageGroup: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.ageGroup,
		}),
		toyType: new FormControl(undefined, {
			nonNullable: true,
			validators: validators.toyType,
		}),
		programYearAdded: new FormControl(programYear, {
			nonNullable: true,
			validators: validators.programYearAdded,
		}),
		enabled: new FormControl(true, {
			nonNullable: true,
			validators: validators.enabled,
		}),
	});
