import { Component, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { NiceFormErrorPipe } from './nice-form-error.pipe';

@Component({
	standalone: true,
	imports: [NiceFormErrorPipe],
	template:
		'<span hidden>{{ renderTick() }}</span><output data-testid="error">{{ control | niceFormError }}</output>',
})
class NiceFormErrorHostComponent {
	public readonly renderTick = signal(0);
	public readonly control = new FormControl('', [
		Validators.required,
		Validators.maxLength(20),
		Validators.email,
	]);
}

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

	it('tracks required, length, email, and valid transitions on one control', () => {
		const pipe = new NiceFormErrorPipe();
		const control = new FormControl('', [
			Validators.required,
			Validators.maxLength(20),
			Validators.email,
		]);

		expect(pipe.transform(control)).toBe('FORM_ERRORS.REQUIRED');

		control.setValue(`${'a'.repeat(21)}@example.test`);
		expect(pipe.transform(control)).toBe('FORM_ERRORS.MAXLENGTH');

		control.setValue('not-an-email');
		expect(pipe.transform(control)).toBe('FORM_ERRORS.EMAIL');

		control.setValue('valid@example.test');
		expect(pipe.transform(control)).toBe('');
	});

	describe('template rendering', () => {
		let fixture: ComponentFixture<NiceFormErrorHostComponent>;

		beforeEach(async () => {
			await TestBed.configureTestingModule({
				imports: [NiceFormErrorHostComponent],
			}).compileComponents();
			fixture = TestBed.createComponent(NiceFormErrorHostComponent);
		});

		it('refreshes rendered errors when one control changes value', () => {
			const errorText = (): string =>
				(
					fixture.nativeElement.querySelector(
						'[data-testid="error"]',
					) as HTMLElement
				).textContent?.trim() ?? '';

			fixture.detectChanges();
			expect(errorText()).toBe('FORM_ERRORS.REQUIRED');

			fixture.componentInstance.control.setValue(
				`${'a'.repeat(21)}@example.test`,
			);
			fixture.componentInstance.renderTick.update((value) => value + 1);
			fixture.detectChanges();
			expect(errorText()).toBe('FORM_ERRORS.MAXLENGTH');

			fixture.componentInstance.control.setValue('not-an-email');
			fixture.componentInstance.renderTick.update((value) => value + 1);
			fixture.detectChanges();
			expect(errorText()).toBe('FORM_ERRORS.EMAIL');

			fixture.componentInstance.control.setValue('valid@example.test');
			fixture.componentInstance.renderTick.update((value) => value + 1);
			fixture.detectChanges();
			expect(errorText()).toBe('');
		});
	});
});
