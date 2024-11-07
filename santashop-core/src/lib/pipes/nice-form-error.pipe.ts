import { Pipe, PipeTransform } from '@angular/core';
import { FormControl } from '@angular/forms';

@Pipe({
	name: 'niceFormError',
	standalone: true,
})
export class NiceFormErrorPipe implements PipeTransform {
	public transform(control: FormControl): string {
		if (!control?.errors) return '';

		const firstError = Object.entries(control.errors)[0][0];

		return `FORM_ERRORS.${firstError.toUpperCase()}`;
	}
}
