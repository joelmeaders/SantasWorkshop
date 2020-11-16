import { FormGroup, Validators } from '@angular/forms';
import { ChildProfile, UserProfile } from 'santashop-core-lib/lib/models';
import { CommonForms } from './common-forms';

export abstract class QuickRegistrationForms {

  public static customerValidators = {
    firstName: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
  };

  public static customerForm(value: UserProfile): FormGroup {
    return CommonForms.formBuilder().group({
      firstName: [value?.firstName ?? undefined, this.customerValidators.firstName],
    });
  }

  public static customerValidationMessages() {
    return {
      firstName: [CommonForms.messages().required, CommonForms.messages(2, 50).minLength, CommonForms.messages(2, 50).maxLength],
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
