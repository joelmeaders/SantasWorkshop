import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular/standalone';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { AppStateService } from '@santashop/core/customer';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../assets/i18n/en.json';
import es from '../../../assets/i18n/es.json';
import {
	createAppStateServiceMock,
	createModalControllerMock,
	provideCustomerAnalyticsMock,
} from '../../../test-helpers';
import { CustomerLanguageService } from '../../core/services/customer-language.service';
import { newOnboardUserForm } from './sign-up.form';
import { SignUpPage } from './sign-up.page';
import { SignUpPageService } from './sign-up.page.service';

describe('signup validation messages with the published catalogs', () => {
	let fixture: ComponentFixture<SignUpPage>;
	let translate: TranslateService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SignUpPage],
			providers: [
				provideRouter([]),
				provideTranslateService(),
				provideCustomerAnalyticsMock(),
				{ provide: AlertController, useValue: { create: vi.fn() } },
				{
					provide: ModalController,
					useFactory: createModalControllerMock,
				},
				{
					provide: AppStateService,
					useFactory: createAppStateServiceMock,
				},
				{
					provide: CustomerLanguageService,
					useValue: {
						language$: new BehaviorSubject('en'),
						setLanguage: vi.fn(),
					},
				},
			],
		})
			.overrideComponent(SignUpPage, {
				set: {
					providers: [
						{
							provide: SignUpPageService,
							useValue: {
								form: newOnboardUserForm(),
								onboardUser: vi.fn(),
							},
						},
					],
				},
			})
			.compileComponents();
		translate = TestBed.inject(TranslateService);
		translate.setTranslation('en', en);
		translate.setTranslation('es', es);
		translate.use('en');
		fixture = TestBed.createComponent(SignUpPage);
		await fixture.whenStable();
	});

	it.each([
		['en', 'password', 'short', 'Minimum length is 8'],
		['es', 'password', 'short', 'La longitud mínima es 8'],
		['en', 'password', 'x'.repeat(41), 'Maximum length is 40'],
		['es', 'password', 'x'.repeat(41), 'La longitud máxima es 40'],
		['en', 'firstName', 'Q', 'Minimum length is 2'],
		['es', 'lastName', 'Q'.repeat(26), 'La longitud máxima es 25'],
	] as const)(
		'renders %s %s limits from its actual validator',
		async (language, field, value, expected) => {
			translate.use(language);
			const control = fixture.componentInstance.form.controls[field];
			control.setValue(value);
			control.markAsDirty();
			control.markAsTouched();
			fixture.detectChanges();
			await fixture.whenStable();
			const input = fixture.nativeElement.querySelector(
				`#${field}`,
			) as HTMLIonInputElement;
			expect(input.errorText).toBe(expected);
		},
	);

	it.each(['en', 'es'] as const)(
		'shows and hides the single password without changing its value in %s',
		async (language) => {
			translate.use(language);
			fixture.componentInstance.form.controls.password.setValue(
				' winter-pass-2026 ',
			);
			fixture.detectChanges();
			await fixture.whenStable();
			const input = fixture.nativeElement.querySelector(
				'#password',
			) as HTMLIonInputElement;
			const native = await input.getInputElement();
			const toggle = input.querySelector(
				'button.password-toggle',
			) as HTMLButtonElement;
			await vi.waitFor(() => expect(native.type).toBe('password'));
			expect(toggle.getAttribute('aria-label')).toBe(
				language === 'en' ? 'Show password' : 'Mostrar contraseña',
			);
			toggle.click();
			await fixture.whenStable();
			await vi.waitFor(() => expect(native.type).toBe('text'));
			expect(toggle.getAttribute('aria-label')).toBe(
				language === 'en' ? 'Hide password' : 'Ocultar contraseña',
			);
			expect(native.spellcheck).toBe(false);
			toggle.click();
			await fixture.whenStable();
			await vi.waitFor(() => expect(native.type).toBe('password'));
			expect(fixture.componentInstance.form.controls.password.value).toBe(
				' winter-pass-2026 ',
			);
			expect(
				fixture.nativeElement.querySelector('#password2'),
			).toBeNull();
		},
	);

	it.each(['en', 'es'] as const)(
		'renders required text after clearing and blurring a valid name in %s',
		async (language) => {
			translate.use(language);
			await fixture.whenStable();
			const input = fixture.nativeElement.querySelector(
				'#firstName',
			) as HTMLIonInputElement;
			const native = await input.getInputElement();
			const control = fixture.componentInstance.form.controls.firstName;
			for (const value of ['QA', '']) {
				native.value = value;
				native.dispatchEvent(new Event('input', { bubbles: true }));
				native.dispatchEvent(new Event('blur', { bubbles: true }));
				await vi.waitFor(() => expect(control.value).toBe(value));
				await fixture.whenStable();
			}
			expect(control.hasError('required')).toBe(true);
			expect(control.touched).toBe(true);
			expect(input.errorText).toBe(
				language === 'en'
					? en.FORM_ERRORS.REQUIRED
					: es.FORM_ERRORS.REQUIRED,
			);
			await vi.waitFor(() => {
				expect(input.className).toMatch(/\bion-invalid\b/);
				expect(input.className).toMatch(/\bion-touched\b/);
			});
		},
	);
});
