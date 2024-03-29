import { Validators } from '@angular/forms';
import { ChangeUserInfo } from '@santashop/models';
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
	zipCode: Validators.compose([
		Validators.required,
		Validators.maxLength(5),
		Validators.pattern(/^\d{5}/),
	]),
};

export const newChangeInfoForm = (): FormGroup<ControlsOf<ChangeUserInfo>> =>
	new FormGroup<ControlsOf<ChangeUserInfo>>({
		firstName: new FormControl<string>(undefined, validators.firstName),
		lastName: new FormControl<string>(undefined, validators.lastName),
		zipCode: new FormControl<number>(undefined, validators.zipCode),
	});
