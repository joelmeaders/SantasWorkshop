import { FormGroup, Validators } from '@angular/forms';
import { CommonForms } from '@app/core/helpers/common-forms';
import { ChildProfile } from 'santashop-core-lib/lib/models';

export abstract class ChildProfileForm {

  private static validators = {
    firstName: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(25)]),
    toyType: Validators.compose([Validators.required]),
    ageGroup: Validators.compose([Validators.required]),
    dateOfBirth: Validators.compose([Validators.required])
  };

  public static form(value: ChildProfile): FormGroup {
    return CommonForms.formBuilder().group({
      id: [value?.id ?? undefined],
      parentId: [value?.parentId ?? undefined],
      firstName: [value?.firstName ?? undefined, this.validators.firstName],
      toyType: [value?.toyType ?? undefined, this.validators.toyType],
      ageGroup: [value?.ageGroup ?? undefined, this.validators.ageGroup],
      dateOfBirth: [value?.dateOfBirth ?? undefined, this.validators.dateOfBirth]
    });
  }

  public static validationMessages() {
    return {
      firstName: [CommonForms.messages().required, CommonForms.messages(2, 50).minLength, CommonForms.messages(2, 50).maxLength],
      toyType: [CommonForms.messages().required],
      ageGroup: [CommonForms.messages().required],
      dateOfBirth: [CommonForms.messages().required]
    };
  }

}
