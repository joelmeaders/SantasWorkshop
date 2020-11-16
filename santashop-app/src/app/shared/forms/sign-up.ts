import { FormGroup, Validators } from '@angular/forms';
import { CommonForms } from 'santashop-core/src/public-api';

export abstract class SignUpForm {

  private static validators = {
    firstName: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
    lastName: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
    zipCode: Validators.compose([Validators.required, Validators.minLength(5), Validators.maxLength(10)]),
    emailAddress: Validators.compose([Validators.required, Validators.email]),
    password: Validators.compose([Validators.required, Validators.minLength(8), Validators.maxLength(50)]),
    termsConditions: Validators.compose([Validators.requiredTrue]),
    privacyPolicy: Validators.compose([Validators.requiredTrue])
  };

  public static form(): FormGroup {
    return CommonForms.formBuilder().group({
      firstName: [undefined, this.validators.firstName],
      lastName: [undefined, this.validators.lastName],
      zipCode: [undefined, this.validators.zipCode],
      emailAddress: [undefined, this.validators.emailAddress],
      password: [undefined, this.validators.password],
      termsConditions: [false, this.validators.termsConditions],
      privacyPolicy: [false, this.validators.privacyPolicy]
    });
  }

  public static validationMessages() {
    return {
      firstName: [CommonForms.messages().required, CommonForms.messages(2, 50).minLength, CommonForms.messages(2, 50).maxLength],
      lastName: [CommonForms.messages().required, CommonForms.messages(2, 50).minLength, CommonForms.messages(2, 50).maxLength],
      zipCode: [CommonForms.messages().required, CommonForms.messages(5, 10).minLength, CommonForms.messages(5, 10).maxLength],
      emailAddress: [CommonForms.messages().required, { type: 'email', message: 'Must be a valid email address' }],
      password: [CommonForms.messages().required, CommonForms.messages(8, 50).minLength, CommonForms.messages(8, 50).maxLength],
      termsConditions: [CommonForms.messages().required, {type: 'required', message: 'Required to continue'}],
      privacyPolicy: [CommonForms.messages().required, {type: 'required', message: 'Required to continue'}],
    };
  }

}
