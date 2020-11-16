import { FormGroup, Validators } from '@angular/forms';
import { CommonForms } from '@app/core/helpers/common-forms';
import { Registration } from 'santashop-core-lib/lib/models';

export abstract class ArrivalDateForm {

  private static validators = {
    date: Validators.compose([Validators.required]),
    time: Validators.compose([Validators.required])
  };

  public static form(value?: Registration): FormGroup {
    return CommonForms.formBuilder().group({
      date: [value?.date ?? undefined, this.validators.date],
      time: [value?.time ?? undefined, this.validators.time]
    });
  }

  public static validationMessages() {
    return {
      date: [CommonForms.messages().required],
      time: [CommonForms.messages().required]
    };
  }

}
