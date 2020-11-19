import { FormGroup } from '@angular/forms';
import { CommonForms } from 'santashop-core/src/public-api';

export abstract class RegistrationSearchForm {

  public static customerForm(): FormGroup {
    return CommonForms.formBuilder().group({
      firstName: [undefined],
      registrationCode: [undefined],
    });
  }
}
