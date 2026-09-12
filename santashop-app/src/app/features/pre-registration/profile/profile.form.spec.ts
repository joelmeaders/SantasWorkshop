import { describe, expect, it } from 'vitest';
import { changePasswordForm } from './profile.form';

describe('changePasswordForm', () => {
	it('accepts one new password and preserves its exact spaces', () => {
		const form = changePasswordForm();
		form.setValue({
			oldPassword: 'old-password',
			newPassword: ' new-password ',
		});
		expect(form.valid).toBe(true);
		expect(form.value.newPassword).toBe(' new-password ');
	});
	it.each([0, 7, 8, 40, 41])(
		'validates a new password of length %i',
		(length) => {
			const form = changePasswordForm();
			form.setValue({
				oldPassword: 'old-password',
				newPassword: 'x'.repeat(length),
			});
			expect(form.valid).toBe(length === 8 || length === 40);
		},
	);
});
