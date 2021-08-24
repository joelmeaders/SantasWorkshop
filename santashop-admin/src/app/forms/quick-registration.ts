import { FormGroup, Validators } from '@angular/forms';
import { IChild, CommonForms, IUser } from 'santashop-core/src';

export abstract class QuickRegistrationForms {

  public static customerValidators = {
    zipCode: Validators.compose([Validators.required, Validators.minLength(5), Validators.maxLength(5)]),
  };

  public static customerForm(value: IUser): FormGroup {
    return CommonForms.formBuilder().group({
      zipCode: [value?.zipCode ?? undefined, this.customerValidators.zipCode],
    });
  }

  public static customerValidationMessages() {
    return {
      zipCode: [CommonForms.messages().required, CommonForms.messages(5).length],
    };
  }

  private static childValidators = {
    toyType: Validators.compose([Validators.required]),
    ageGroup: Validators.compose([Validators.required]),
  };

  public static childForm(value: IChild): FormGroup {
    return CommonForms.formBuilder().group({
      toyType: [value?.toyType ?? undefined, this.childValidators.toyType],
      ageGroup: [value?.ageGroup ?? undefined, this.childValidators.ageGroup],
    });
  }

  public static childValidationMessages() {
    return {
      toyType: [CommonForms.messages().required],
      ageGroup: [CommonForms.messages().required],
    };
  }

}
