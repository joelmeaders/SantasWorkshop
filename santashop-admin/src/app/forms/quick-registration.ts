import { FormGroup, Validators } from '@angular/forms';
import { ChildProfile, CommonForms, UserProfile } from 'santashop-core/src/public-api';

export abstract class QuickRegistrationForms {

  public static customerValidators = {
    zipCode: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
  };

  public static customerForm(value: UserProfile): FormGroup {
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

  public static childForm(value: ChildProfile): FormGroup {
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
