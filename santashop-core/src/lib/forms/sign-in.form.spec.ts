import { describe, expect, it } from 'vitest';
import { newAuthForm } from './sign-in.form';

describe('newAuthForm', () => {
	it('creates required email and password controls with length validation', () => {
		const form = newAuthForm();

		expect(form.controls.emailAddress.hasError('required')).toBe(true);
		expect(form.controls.password.hasError('required')).toBe(true);

		form.setValue({ emailAddress: 'bad', password: 'short' });
		expect(form.controls.emailAddress.hasError('email')).toBe(true);
		expect(form.controls.emailAddress.hasError('minlength')).toBe(true);
		expect(form.controls.password.hasError('minlength')).toBe(true);

		form.setValue({
			emailAddress: `${'a'.repeat(243)}@example.test`,
			password: 'a'.repeat(41),
		});
		expect(form.controls.emailAddress.hasError('maxlength')).toBe(true);
		expect(form.controls.password.hasError('maxlength')).toBe(true);
	});

	it('accepts a valid email address up to the backend limit', () => {
		const form = newAuthForm();
		const emailAddress = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`;

		form.controls.emailAddress.setValue(emailAddress);

		expect(emailAddress).toHaveLength(254);
		expect(form.controls.emailAddress.valid).toBe(true);
	});

	it('accepts a valid email and password', () => {
		const form = newAuthForm();
		form.setValue({
			emailAddress: 'customer@example.test',
			password: 'good-password',
		});

		expect(form.valid).toBe(true);
	});
});
