import { FormBuilder } from '@angular/forms';

export abstract class CommonForms {
  public static readonly formBuilder = () => new FormBuilder();

  public static messages(
    minLength?: string | number,
    maxLength?: string | number
  ): any {
    return {
      required: { type: 'required', message: 'This field is required' },
      minLength: {
        type: 'minlength',
        message: `Must be between ${minLength}-${maxLength} characters`,
      },
      maxLength: {
        type: 'maxlength',
        message: `Must be between ${minLength}-${maxLength} characters`,
      },
    };
  }
}
