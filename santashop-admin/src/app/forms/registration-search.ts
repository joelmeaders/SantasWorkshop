import { FormGroup } from '@angular/forms';
import { CommonForms } from 'santashop-core/src/public-api';

export abstract class RegistrationSearchForm {

  public static registrationSearchForm(): FormGroup {
    return CommonForms.formBuilder().group({
      firstName: [undefined],
      lastName: [undefined],
      registrationCode: [undefined],
    });
  }
}
