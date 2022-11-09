import { FormGroup } from '@angular/forms';
import { CommonForms } from '@core/*';

export abstract class RegistrationSearchForm {
	public static registrationSearchForm(): FormGroup {
		return CommonForms.formBuilder().group({
			firstName: [undefined],
			lastName: [undefined],
			registrationCode: [undefined],
		});
	}
}
