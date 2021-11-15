import { FormBuilder } from '@ngneat/reactive-forms';
export abstract class FormFunctions {
  public static formBuilder(): FormBuilder {
    return new FormBuilder();
  }
}