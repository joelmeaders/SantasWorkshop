import { ApplicationRef, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
	AlertController,
	IonSelect,
	IonSelectOption,
} from '@ionic/angular/standalone';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslateService } from '@ngx-translate/core';
import { throwError } from 'rxjs';
import { AdminSelectLanguageService } from './admin-select-language.service';
import { AdminAlertController } from './admin-overlays';
import { AdminLanguageService } from './admin-language.service';
import { AdminThemeService } from './admin-theme.service';
import { AdminPreferencesComponent } from './admin-preferences.component';
import { AdminTextPipe } from './admin-text.pipe';
import { AdminDatePipe } from './admin-date.pipe';
import english from '../../../assets/i18n/en.json';
import spanish from '../../../assets/i18n/es.json';

@Component({
	template:
		'<admin-preferences /><label>{{ "First Name" | adminText }}<input [formControl]="name" /></label>',
	imports: [AdminPreferencesComponent, AdminTextPipe, ReactiveFormsModule],
})
class PreferenceFormComponent {
	public readonly name = new FormControl('María');
}

@Component({
	template: `<ion-select
		[multiple]="true"
		[formControl]="roles"
		[label]="'Roles' | adminText"
		[okText]="'OK' | adminText"
		[cancelText]="'Cancel' | adminText"
		><ion-select-option value="admin">{{
			'Administrator' | adminText
		}}</ion-select-option
		><ion-select-option value="checkin">{{
			'Check-In' | adminText
		}}</ion-select-option></ion-select
	>`,
	imports: [IonSelect, IonSelectOption, ReactiveFormsModule, AdminTextPipe],
})
class PreferenceSelectComponent {
	public readonly roles = new FormControl<string[]>([]);
}

describe('Admin language and appearance', () => {
	beforeEach(async () => {
		TestBed.overrideProvider(AlertController, {
			useFactory: () => inject(AdminAlertController),
		});
		await TestBed.inject(AdminLanguageService).initialize();
		TestBed.inject(AdminSelectLanguageService);
	});
	afterEach(async () => {
		for (const alert of document.querySelectorAll('ion-alert'))
			await alert.dismiss();
		vi.restoreAllMocks();
	});

	it('translates the interface without replacing entered customer data or input elements', async () => {
		const fixture = TestBed.createComponent(PreferenceFormComponent);
		await fixture.whenStable();
		const input = fixture.nativeElement.querySelector(
			'input',
		) as HTMLInputElement;
		input.focus();
		const language = TestBed.inject(AdminLanguageService);
		await language.setLanguage('es');
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain('Nombre');
		expect(fixture.nativeElement.querySelector('input')).toBe(input);
		expect(input.value).toBe('María');
		expect(document.activeElement).toBe(input);
		expect(document.documentElement.lang).toBe('es');
		expect(localStorage.getItem('santashop-admin-language')).toBe('es');
		expect(localStorage.getItem('santashop-language')).not.toBe('es');
		await language.setLanguage('en');
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain('First Name');
	});

	it('restores Spanish and falls back to readable English for missing keys', async () => {
		localStorage.setItem('santashop-admin-language', 'es');
		const language = TestBed.inject(AdminLanguageService);
		await language.initialize();
		expect(language.text('Search')).toBe('Buscar');
		expect(language.text('First\n    Name')).toBe('Nombre');
		expect(language.text('Reserved {{ v0 }} of {{\n v1 }}', {v0: 2, v1: 10})).toBe('Reservados: 2 de 10');
		expect(language.text('An untranslated phrase')).toBe(
			'An untranslated phrase',
		);
	});

	it('keeps preferences usable when storage is blocked', async () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('Blocked');
		});
		await TestBed.inject(AdminLanguageService).setLanguage('es');
		TestBed.inject(AdminThemeService).setTheme('dark');
		expect(TestBed.inject(AdminLanguageService).text('Search')).toBe(
			'Buscar',
		);
		expect(document.documentElement.dataset['adminTheme']).toBe('dark');
	});

	it('uses English and the device theme when stored preferences cannot be read', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new DOMException('Blocked');
		});
		const language = TestBed.inject(AdminLanguageService);
		await language.initialize();
		expect(language.language()).toBe('en');
		const theme = new AdminThemeService();
		expect(theme.theme()).toBe('system');
		theme.ngOnDestroy();
	});

	it('keeps the current language and reports a failed dictionary load', async () => {
		const language = TestBed.inject(AdminLanguageService);
		vi.spyOn(TestBed.inject(TranslateService), 'use').mockReturnValue(
			throwError(() => new Error('Dictionary unavailable')),
		);
		await language.setLanguage('es');
		expect(language.language()).toBe('en');
		expect(language.loadFailed()).toBe(true);
		expect(language.changing()).toBe(false);
		expect(language.text('Search')).toBe('Search');
	});

	it('explicit themes override device preference and System follows changes', () => {
		const media = new EventTarget() as EventTarget & { matches: boolean };
		media.matches = false;
		vi.spyOn(window, 'matchMedia').mockReturnValue(media as MediaQueryList);
		const theme = new AdminThemeService();
		theme.setTheme('dark');
		expect(theme.dark()).toBe(true);
		media.dispatchEvent(new Event('change'));
		expect(theme.dark()).toBe(true);
		theme.setTheme('light');
		media.matches = true;
		media.dispatchEvent(new Event('change'));
		expect(theme.dark()).toBe(false);
		theme.setTheme('system');
		expect(theme.dark()).toBe(true);
		media.matches = false;
		media.dispatchEvent(new Event('change'));
		expect(theme.dark()).toBe(false);
		theme.ngOnDestroy();
	});

	it('presents message-only alerts with safe Ionic array defaults', async () => {
		const alert = await TestBed.inject(AlertController).create({
			header: 'Unable to validate code',
			message: 'Try the scan again or contact a DSCS member.',
			buttons: ['OK'],
			animated: false,
		});
		await alert.present();
		expect(alert.inputs).toEqual([]);
		await TestBed.inject(AdminLanguageService).setLanguage('es');
		TestBed.tick();
		await vi.waitFor(() =>
			expect(alert.message).not.toBe(
				'Try the scan again or contact a DSCS member.',
			),
		);
	});

	it('updates an open dialog while retaining the code typed into it', async () => {
		const alert = await TestBed.inject(AlertController).create({
			header: 'Enter registration code',
			inputs: [
				{ name: 'code', placeholder: 'Code (8 letters or numbers)' },
			],
			buttons: ['Cancel', 'OK'],
			animated: false,
		});
		await alert.present();
		const input = alert.querySelector('input') as HTMLInputElement;
		input.value = 'ABC12345';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await TestBed.inject(AdminLanguageService).setLanguage('es');
		TestBed.tick();
		await TestBed.inject(ApplicationRef).whenStable();
		await vi.waitFor(() =>
			expect(alert.header).toBe('Ingrese el código de inscripción'),
		);
		expect((alert.querySelector('input') as HTMLInputElement).value).toBe(
			'ABC12345',
		);
		expect(alert.buttons).toContain('Cancelar');
	});

	it('updates Ionic select dialogs and retains unconfirmed choices without saving them', async () => {
		const fixture = TestBed.createComponent(PreferenceSelectComponent);
		await fixture.whenStable();
		const select = fixture.nativeElement.querySelector(
			'ion-select',
		) as HTMLIonSelectElement;
		await select.open();
		const alert = document.querySelector(
			'ion-alert.select-alert',
		) as HTMLIonAlertElement;
		await vi.waitFor(() =>
			expect(alert.querySelector('[role="checkbox"]')).not.toBeNull(),
		);
		(alert.querySelector('[role="checkbox"]') as HTMLElement).click();
		await vi.waitFor(() =>
			expect(
				alert
					.querySelector('[role="checkbox"]')
					?.getAttribute('aria-checked'),
			).toBe('true'),
		);
		await TestBed.inject(AdminLanguageService).setLanguage('es');
		TestBed.tick();
		await vi.waitFor(() => expect(alert.header).toBe('Roles'));
		expect(alert.inputs[0].checked).toBe(true);
		expect(
			alert.buttons.some(
				(button) =>
					typeof button === 'object' && button.text === 'Cancelar',
			),
		).toBe(true);
		expect(fixture.componentInstance.roles.value).toEqual([]);
		await alert.dismiss(undefined, 'cancel');
		expect(fixture.componentInstance.roles.value).toEqual([]);
	});

	it('formats Spanish dates in Denver time rather than the browser timezone', async () => {
		await TestBed.inject(AdminLanguageService).setLanguage('es');
		const pipe = TestBed.runInInjectionContext(() => new AdminDatePipe());
		expect(pipe.transform('2026-12-13T01:00:00Z', 'longDate')).toContain(
			'12 de diciembre',
		);
	});

	it('keeps translation keys and interpolation parameters identical', () => {
		expect(Object.keys(spanish).sort()).toEqual(
			Object.keys(english).sort(),
		);
		for (const key of Object.keys(english) as (keyof typeof english)[]) {
			expect(spanish[key].trim(), key).not.toBe('');
			expect(
				(spanish[key].match(/\{\{\w+\}\}/g) ?? []).sort(),
				key,
			).toEqual((english[key].match(/\{\{\w+\}\}/g) ?? []).sort());
		}
	});
});
