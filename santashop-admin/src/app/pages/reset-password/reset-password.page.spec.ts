import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@santashop/core/admin';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { ResetPasswordPage } from './reset-password.page';

describe('ResetPasswordPage', () => {
	let fixture: ComponentFixture<ResetPasswordPage>;
	let page: ResetPasswordPage;
	const resetPassword = vi.fn();
	beforeEach(async () => {
		resetPassword.mockReset().mockResolvedValue(undefined);
		await TestBed.configureTestingModule({
			imports: [ResetPasswordPage],
			providers: [
				provideRouter([]),
				{ provide: AuthService, useValue: { resetPassword } },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ResetPasswordPage);
		page = fixture.componentInstance;
		await fixture.whenStable();
	});
	it('does not send empty or malformed email and shows validation after submission', async () => {
		await page.requestReset();
		expect(resetPassword).not.toHaveBeenCalled();
		expect(page.email.touched).toBe(true);
		page.email.setValue('not-an-email');
		await page.requestReset();
		expect(resetPassword).not.toHaveBeenCalled();
	});
	it('submits once with Enter from the actual email input and shows account-private confirmation', async () => {
		const input = await (
			fixture.nativeElement.querySelector(
				'#adminResetEmail',
			) as HTMLIonInputElement
		).getInputElement();
		await userEvent.fill(input, 'staff@example.test');
		await userEvent.keyboard('{Enter}');
		await fixture.whenStable();
		expect(resetPassword).toHaveBeenCalledExactlyOnceWith(
			'staff@example.test',
		);
		expect(page.accepted()).toBe(true);
		expect(
			fixture.nativeElement.querySelector('[role=status]').textContent,
		).toContain('If an account exists');
		expect(fixture.nativeElement.querySelector('form')).toBeNull();
	});
	it('submits by button and trims email', async () => {
		page.email.setValue(' staff@example.test ');
		await fixture.whenStable();
		await userEvent.click(
			fixture.nativeElement.querySelector('#adminResetButton'),
		);
		await fixture.whenStable();
		expect(resetPassword).toHaveBeenCalledExactlyOnceWith(
			'staff@example.test',
		);
	});
	it('ignores duplicate requests while pending and after acceptance', async () => {
		let resolve!: () => void;
		resetPassword.mockReturnValue(
			new Promise<void>((r) => {
				resolve = r;
			}),
		);
		page.email.setValue('staff@example.test');
		const first = page.requestReset();
		await page.requestReset();
		expect(resetPassword).toHaveBeenCalledOnce();
		expect(page.pending()).toBe(true);
		resolve();
		await first;
		await page.requestReset();
		expect(resetPassword).toHaveBeenCalledOnce();
		expect(page.pending()).toBe(false);
	});
	it('never exposes provider errors and allows an explicit retry', async () => {
		resetPassword.mockRejectedValueOnce(
			new Error('account missing: private@example.test'),
		);
		page.email.setValue('staff@example.test');
		await page.requestReset();
		await fixture.whenStable();
		expect(page.failed()).toBe(true);
		expect(page.pending()).toBe(false);
		expect(fixture.nativeElement.textContent).not.toContain(
			'private@example.test',
		);
		expect(fixture.nativeElement.textContent).not.toContain(
			'account missing',
		);
		await page.requestReset();
		expect(page.failed()).toBe(false);
		expect(page.accepted()).toBe(true);
	});
	it('allows correcting an email after an accepted request', async () => {
		page.email.setValue('first@example.test');
		await page.requestReset();
		page.changeEmail();
		await fixture.whenStable();
		expect(page.accepted()).toBe(false);
		expect(page.email.value).toBe('');
		page.email.setValue('second@example.test');
		await page.requestReset();
		expect(resetPassword).toHaveBeenLastCalledWith('second@example.test');
	});
	it('does not submit an IME composition and has a sign-in link', async () => {
		page.email.setValue('staff@example.test');
		const input = await (
			fixture.nativeElement.querySelector(
				'#adminResetEmail',
			) as HTMLIonInputElement
		).getInputElement();
		input.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'Enter',
				isComposing: true,
				bubbles: true,
				composed: true,
				cancelable: true,
			}),
		);
		input.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'Enter',
				keyCode: 229,
				bubbles: true,
				composed: true,
				cancelable: true,
			}),
		);
		expect(resetPassword).not.toHaveBeenCalled();
		expect(
			fixture.nativeElement.querySelector('[routerLink="/"]'),
		).toBeTruthy();
	});
});
