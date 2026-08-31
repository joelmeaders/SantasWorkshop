import { describe, expect, it } from 'vitest';
import { FormControl, Validators } from '@angular/forms';
import { NiceFormErrorPipe } from './nice-form-error.pipe';

describe('NiceFormErrorPipe', () => {
	it('create an instance', () => {
		const pipe = new NiceFormErrorPipe();
		expect(pipe).toBeTruthy();
	});

	it('returns an empty string for a control without errors', () => {
		const pipe = new NiceFormErrorPipe();
		expect(pipe.transform(new FormControl('valid'))).toBe('');
	});

	it('formats the first validation error as a translation key', () => {
		const pipe = new NiceFormErrorPipe();
		const control = new FormControl('', [Validators.required]);

		expect(pipe.transform(control)).toBe('FORM_ERRORS.REQUIRED');
	});
});
