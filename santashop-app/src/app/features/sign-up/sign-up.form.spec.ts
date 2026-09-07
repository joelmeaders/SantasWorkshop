import { describe, expect, it } from 'vitest';
import { newOnboardUserForm } from './sign-up.form';

describe('newOnboardUserForm', () => {
	it('accepts a normal valid email address longer than 40 characters', () => {
		const form = newOnboardUserForm();
		const emailAddress = 'joelmeaders+qa0907-customer-journeys@gmail.com';

		form.controls.emailAddress.setValue(emailAddress);

		expect(emailAddress.length).toBeGreaterThan(40);
		expect(form.controls.emailAddress.valid).toBe(true);
	});

	it('keeps the backend email length safety bound', () => {
		const form = newOnboardUserForm();

		form.controls.emailAddress.setValue(`${'a'.repeat(242)}@example.test`);

		expect(form.controls.emailAddress.hasError('maxlength')).toBe(true);
	});
});
