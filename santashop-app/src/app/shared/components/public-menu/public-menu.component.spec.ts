import { CustomerLanguageService } from '../../../core/services/customer-language.service';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
	ModalController,
	PopoverController,
	provideIonicAngular,
} from '@ionic/angular/standalone';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@santashop/core/customer';
import en from '../../../../assets/i18n/en.json';
import es from '../../../../assets/i18n/es.json';
import {
	createPopoverControllerMock,
	createModalControllerMock,
	provideTranslateServiceMock,
	provideCustomerAnalyticsMock,
	provideCustomerAuthMock,
	provideCustomerFunctionsMock,
} from '../../../../test-helpers';
import { PublicMenuComponent } from './public-menu.component';

describe('PublicMenuComponent', () => {
	let component: PublicMenuComponent;
	let fixture: ComponentFixture<PublicMenuComponent>;
	const router = { navigate: vi.fn().mockResolvedValue(true) };

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PublicMenuComponent],
			providers: [
				{
					provide: CustomerLanguageService,
					useValue: {
						language$: of('en'),
						setLanguage: vi.fn(async (language: string) =>
							window.localStorage.setItem(
								'santashop-language',
								language,
							),
						),
					},
				},
				provideCustomerAuthMock(),
				provideCustomerFunctionsMock(),
				provideCustomerAnalyticsMock(),
				{
					provide: PopoverController,
					useValue: createPopoverControllerMock(),
				},
				{
					provide: ModalController,
					useValue: createModalControllerMock(),
				},
				{ provide: Router, useValue: router },
				provideTranslateServiceMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(PublicMenuComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('navigates account actions, opens help, and saves the selected language', async (): Promise<void> => {
		const popover = TestBed.inject(PopoverController) as any;
		const modal = TestBed.inject(ModalController) as any;
		popover.dismiss.mockResolvedValue(undefined);
		modal.create.mockResolvedValue({
			present: vi.fn().mockResolvedValue(undefined),
		});

		await component.home();
		await component.profile();
		await component.signIn();
		await component.help();
		await component.setLanguage('es');

		expect(router.navigate).toHaveBeenNthCalledWith(1, ['/']);
		expect(router.navigate).toHaveBeenNthCalledWith(2, [
			'/pre-registration/profile',
		]);
		expect(router.navigate).toHaveBeenNthCalledWith(3, ['/'], {
			queryParams: { mode: 'sign-in' },
		});
		expect(modal.create).toHaveBeenCalledOnce();
		expect(window.localStorage.getItem('santashop-language')).toBe('es');
		expect(popover.dismiss).toHaveBeenCalledTimes(5);
	});
});

describe('PublicMenuComponent Help modal', () => {
	let component: PublicMenuComponent;
	let viewport: { width: number; height: number };

	beforeEach(async (): Promise<void> => {
		viewport = { width: window.innerWidth, height: window.innerHeight };
		await page.viewport(390, 844);
		await TestBed.configureTestingModule({
			imports: [PublicMenuComponent],
			providers: [
				provideIonicAngular({ animated: false, mode: 'md' }),
				provideTranslateService(),
				{
					provide: CustomerLanguageService,
					useValue: { language$: of('en'), setLanguage: vi.fn() },
				},
				{ provide: AuthService, useValue: { currentUser$: of(null) } },
				{ provide: Router, useValue: { navigate: vi.fn() } },
				{
					provide: PopoverController,
					useValue: createPopoverControllerMock(),
				},
			],
		}).compileComponents();
		const translate = TestBed.inject(TranslateService);
		translate.setTranslation('en', en);
		translate.setTranslation('es', es);
		const fixture = TestBed.createComponent(PublicMenuComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	afterEach(async (): Promise<void> => {
		const modal = await TestBed.inject(ModalController).getTop();
		await modal?.dismiss();
		await page.viewport(viewport.width, viewport.height);
	});

	it.each(['en', 'es'] as const)(
		'keeps the full contact button reachable after scrolling on mobile in %s',
		async (language): Promise<void> => {
			TestBed.inject(TranslateService).use(language);
			await component.help();
			const modal = await TestBed.inject(ModalController).getTop();
			const content = modal?.querySelector('ion-content');
			const contact = modal?.querySelector('ion-button[target="_blank"]');
			expect(content).toBeTruthy();
			expect(contact).toBeTruthy();
			expect(contact?.textContent?.trim()).toBe(
				language === 'es' ? es.HELP.VISIT_BUTTON : en.HELP.VISIT_BUTTON,
			);
			await content?.scrollToBottom(0);
			await vi.waitFor(() => {
				const bounds = contact?.getBoundingClientRect();
				expect(bounds?.height).toBeGreaterThan(0);
				expect(bounds?.top).toBeGreaterThanOrEqual(0);
				expect(bounds?.bottom).toBeLessThanOrEqual(window.innerHeight);
			});
		},
	);
});
