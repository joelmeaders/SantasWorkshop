import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { createModalControllerMock } from '../../../../test-helpers';
import en from '../../../../assets/i18n/en.json';
import es from '../../../../assets/i18n/es.json';
import { HelpPage } from './help.page';

describe('HelpPage', () => {
	let component: HelpPage;
	let fixture: ComponentFixture<HelpPage>;
	let modalController: { dismiss: ReturnType<typeof vi.fn> };
	let translate: TranslateService;

	beforeEach(async (): Promise<void> => {
		modalController = createModalControllerMock() as unknown as {
			dismiss: ReturnType<typeof vi.fn>;
		};
		await TestBed.configureTestingModule({
			imports: [HelpPage],
			providers: [
				provideTranslateService(),
				{ provide: ModalController, useValue: modalController },
			],
		}).compileComponents();
		translate = TestBed.inject(TranslateService);
		translate.setTranslation('en', en);
		translate.setTranslation('es', es);
		translate.use('en');
		fixture = TestBed.createComponent(HelpPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it.each([
		['en', 'Help'],
		['es', 'Ayuda'],
	] as const)(
		'exposes one level-one page heading with real Ionic components in %s',
		async (language, title): Promise<void> => {
			translate.use(language);
			fixture.detectChanges();
			await fixture.whenStable();
			const host = fixture.nativeElement as HTMLElement;
			const header = host.querySelector('ion-card-header');
			await vi.waitFor(() => {
				expect(header?.shadowRoot).toBeInstanceOf(ShadowRoot);
			});
			const headings = page
				.elementLocator(host)
				.getByRole('heading', { name: title, exact: true });
			expect(headings.all()).toHaveLength(1);
			await expect
				.element(
					page.elementLocator(host).getByRole('heading', {
						name: title,
						exact: true,
						level: 1,
					}),
				)
				.toBeInTheDocument();
		},
	);

	it.each([
		[
			'en',
			[
				'Create or sign in to your account',
				'Add your children',
				'Choose an appointment',
				'Review and submit',
				'Keep your ticket',
			],
		],
		[
			'es',
			[
				'Cree su cuenta o inicie sesión',
				'Agregue a sus niños',
				'Elija una cita',
				'Revise y envíe',
				'Guarde su entrada',
			],
		],
	] as const)(
		'renders the current registration steps in %s from the real catalog',
		async (language, headings): Promise<void> => {
			translate.use(language);
			fixture.detectChanges();
			await fixture.whenStable();
			const host = fixture.nativeElement as HTMLElement;
			const catalog = language === 'es' ? es : en;
			expect(host.querySelector('h1')?.textContent?.trim()).toBe(
				language === 'es' ? 'Ayuda' : 'Help',
			);
			expect(
				Array.from(host.querySelectorAll('ol li h3'), (heading) =>
					heading.textContent?.trim(),
				),
			).toEqual(headings);
			expect(host.querySelector('ol li')?.textContent).toContain(
				catalog.SIGNUP.SUBMIT_BUTTON,
			);
			const review = host.querySelectorAll('ol li')[3]?.textContent;
			expect(review).toContain(catalog.OVERVIEW.FINAL_STEP_ACTION);
			expect(review).toContain(catalog.MENU.SUBMIT);
			expect(host.textContent).toContain(
				language === 'es' ? 'código QR' : 'QR code',
			);
			expect(host.textContent).not.toMatch(/HELP\.|PDF|robot|CAPTCHA/);
			expect(host.querySelector('[href$=".pdf"]')).toBeNull();
			const contact = host.querySelector(
				'ion-button[href="https://www.facebook.com/denversantaclausshop/"]',
			);
			expect(contact?.textContent?.trim()).toBe(
				language === 'es' ? es.HELP.VISIT_BUTTON : en.HELP.VISIT_BUTTON,
			);
			expect(contact?.getAttribute('target')).toBe('_blank');
			expect(contact?.getAttribute('rel')).toBe('noopener noreferrer');
		},
	);

	it('closes help through the rendered back button', async (): Promise<void> => {
		const back = fixture.nativeElement.querySelector(
			'ion-button[aria-label="Go Back"]',
		) as HTMLIonButtonElement;
		back.click();
		await fixture.whenStable();
		expect(modalController.dismiss).toHaveBeenCalledOnce();
	});

	it('renders help content and closes its modal', async (): Promise<void> => {
		expect(fixture.nativeElement.querySelector('ion-card')).toBeTruthy();

		await component.close();

		expect(modalController.dismiss).toHaveBeenCalledOnce();
	});
});
