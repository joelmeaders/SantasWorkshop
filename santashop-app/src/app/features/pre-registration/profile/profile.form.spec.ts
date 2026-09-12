import { describe, expect, it } from 'vitest';
import { changePasswordForm } from './profile.form';

describe('changePasswordForm', () => {
	it('revalidates the match when either new password changes', () => {
		const form = changePasswordForm();
		form.setValue({
			oldPassword: 'old-password',
			newPassword: 'new-password',
			newPassword2: 'different-password',
		});
		expect(form.hasError('passwordMismatch')).toBe(true);
		form.controls.newPassword2.setValue('new-password');
		expect(form.valid).toBe(true);
		form.controls.newPassword.setValue('another-password');
		expect(form.hasError('passwordMismatch')).toBe(true);
		form.controls.newPassword2.setValue('another-password');
		expect(form.valid).toBe(true);
	});

	it('compares passwords exactly, including spaces', () => {
		const form = changePasswordForm();
		form.setValue({
			oldPassword: 'old-password',
			newPassword: ' new-password ',
			newPassword2: 'new-password',
		});
		expect(form.invalid).toBe(true);
		form.controls.newPassword2.setValue(' new-password ');
		expect(form.valid).toBe(true);
	});

	it.each(['', 'short', 'x'.repeat(41)])(
		'rejects invalid new password %s',
		(password) => {
			const form = changePasswordForm();
			form.setValue({
				oldPassword: 'old-password',
				newPassword: password,
				newPassword2: password,
			});
			expect(form.invalid).toBe(true);
		},
	);
});
