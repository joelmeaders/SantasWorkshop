import { AbstractControl, ValidationErrors } from '@angular/forms';

export abstract class Validators {
   
  public static url(control: AbstractControl): ValidationErrors | null {
    if (Validators.isEmptyInputValue(control.value as string)) {
      return null;
    }
  
    const URL_REGEXP = /[(http(s)?):\\/\\/(www\\.)?a-zA-Z0-9@:%._\\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\\+.~#?&//=]*)/ig;
    return URL_REGEXP.test(control.value) ? null : { 'url': false };
  }

  public static zipCode(control: AbstractControl): ValidationErrors | null {
    if (Validators.isEmptyInputValue(control.value)) {
      return null;
    }
  
    const ZIPCODE_REGEXP = /^\d{5}$/;
  
    return ZIPCODE_REGEXP.test(control.value) ? null : { 'zipCode': true };
  }

  public static isEmptyInputValue(value: string): boolean {
    return value == null || value.length === 0;
  }
}