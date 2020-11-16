import { FormGroup, Validators } from '@angular/forms';
import { CommonForms } from './common-forms';

export abstract class SignInForm {

  private static validators = {
    emailAddress: Validators.compose([Validators.required, Validators.email]),
    password: Validators.compose([Validators.required, Validators.minLength(8), Validators.maxLength(50)]),
  };

  public static form(): FormGroup {
    return CommonForms.formBuilder().group({
      emailAddress: [undefined, this.validators.emailAddress],
      password: [undefined, this.validators.password],
    });
  }

  public static validationMessages() {
    return {
      emailAddress: [CommonForms.messages().required, { type: 'email', message: 'Must be a valid email address' }],
      password: [CommonForms.messages().required, CommonForms.messages(8, 50).minLength, CommonForms.messages(8, 50).maxLength]
    };
  }
}
