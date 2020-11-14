import { FormGroup, Validators } from '@angular/forms';
import { CommonForms } from '@app/core/helpers/common-forms';

export abstract class SignUpInfoForm {

  private static validators = {
    firstName: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
    lastName: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
    zipCode: Validators.compose([Validators.required, Validators.minLength(5), Validators.maxLength(10)]),
  };

  public static form(): FormGroup {
    return CommonForms.formBuilder().group({
      firstName: [undefined, this.validators.firstName],
      lastName: [undefined, this.validators.lastName],
      zipCode: [undefined, this.validators.zipCode],
    });
  }

  public static validationMessages() {
    return {
      firstName: [CommonForms.messages().required, CommonForms.messages(2, 50).minLength, CommonForms.messages(2, 50).maxLength],
      lastName: [CommonForms.messages().required, CommonForms.messages(2, 50).minLength, CommonForms.messages(2, 50).maxLength],
      zipCode: [CommonForms.messages().required, CommonForms.messages(5, 10).minLength, CommonForms.messages(5, 10).maxLength],
    };
  }
}
