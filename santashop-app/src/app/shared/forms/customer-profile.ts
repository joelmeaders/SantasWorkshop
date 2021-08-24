import { FormGroup, Validators } from '@angular/forms';
import { CommonForms, IUser } from 'santashop-core/src';

export abstract class CustomerProfileForm {

  public static validators = {
    firstName: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
    lastName: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
    emailAddress: Validators.compose([Validators.required, Validators.email]),
    zipCode: Validators.compose([Validators.required, Validators.minLength(5), Validators.maxLength(10)])
  };

  public static form(value: IUser): FormGroup {
    return CommonForms.formBuilder().group({
      firstName: [value?.firstName ?? undefined, this.validators.firstName],
      lastName: [value?.lastName ?? undefined, this.validators.lastName],
      emailAddress: [value?.emailAddress ?? undefined, this.validators.emailAddress],
      zipCode: [value?.zipCode ?? undefined, this.validators.zipCode],
    });
  }

  public static validation() {
    return {
      firstName: [CommonForms.messages().required, CommonForms.messages(2, 50).minLength, CommonForms.messages(2, 50).maxLength],
      lastName: [CommonForms.messages().required, CommonForms.messages(2, 50).minLength, CommonForms.messages(2, 50).maxLength],
      emailAddress: [CommonForms.messages().required, { type: 'email', message: 'Must be a valid email address' }],
      zipCode: [CommonForms.messages().required, CommonForms.messages(5, 10).minLength, CommonForms.messages(5, 10).maxLength],
    };
  }

}
