import {
	beforeEach,
	describe,
	expect,
	it,
	type Mocked,
	vi,
} from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, AlertController } from '@ionic/angular/standalone';
import {
	provideTranslateServiceMock,
	createModalControllerMock,
	createAppStateServiceMock,
	provideCustomerAnalyticsMock,
	provideCustomerAuthMock,
	provideCustomerFunctionsMock,
	provideActivatedRouteMock,
} from '../../../../test-helpers';
import { SignUpPage } from './sign-up.page';
import { SignUpPageService } from './sign-up.page.service';
import { newOnboardUserForm } from './sign-up.form';
import { AppStateService } from '@santashop/core/customer';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AnalyticsWrapper } from '@santashop/core/customer';

describe('SignUpPage', () => {
	let component: SignUpPage;
	let fixture: ComponentFixture<SignUpPage>;
	let modalController: Mocked<ModalController>;

	beforeEach(async () => {
		modalController = createModalControllerMock();
		TestBed.configureTestingModule({
			imports: [SignUpPage],
			providers: [
				{
					provide: SignUpPageService,
					useValue: {
						onboardUser: vi
							.fn()
							.mockName('SignUpPageService.onboardUser'),
						form: newOnboardUserForm(),
						email$: of(''),
						password$: of(''),
					},
				},
				{
					provide: AppStateService,
					useFactory: createAppStateServiceMock,
				},
				provideCustomerAnalyticsMock(),
				provideCustomerAuthMock(),
				provideCustomerFunctionsMock(),
				{
					provide: AlertController,
					useValue: {
						create: vi.fn().mockName('AlertController.create'),
					},
				},
				{
					provide: ModalController,
					useValue: modalController,
				},
				provideTranslateServiceMock(),
				provideActivatedRouteMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(SignUpPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('saves a confirmed referral returned by the selection modal', async () => {
		const modal = {
			present: vi.fn().mockName('present').mockResolvedValue(undefined),
			onDidDismiss: vi
				.fn()
				.mockName('onDidDismiss')
				.mockResolvedValue({ role: 'confirm', data: 'Friend' }),
		};
		modalController.create.mockResolvedValue(modal as never);

		await component.showReferralModal();
		await fixture.whenStable();

		expect(component.form.controls.referredBy.value).toBe('Friend');
		expect(
			(fixture.nativeElement.querySelector('#referralSelector') as HTMLElement)
				.innerText,
		).toContain('Friend');
		expect(modalController.create).toHaveBeenCalled();
	});

	it('preserves the prior referral when the modal is cancelled', async () => {
		component.form.controls.referredBy.setValue('Friend');
		const modal = {
			present: vi.fn().mockName('present').mockResolvedValue(undefined),
			onDidDismiss: vi
				.fn()
				.mockName('onDidDismiss')
				.mockResolvedValue({ role: 'cancel', data: undefined }),
		};
		modalController.create.mockResolvedValue(modal as never);

		await component.showReferralModal();

		expect(component.form.controls.referredBy.value).toBe('Friend');
	});

	it('exposes the referral question, required state, answer, and error description accessibly', async () => {
		component.form.controls.referredBy.markAsTouched();
		await fixture.whenStable();

		const selector = fixture.nativeElement.querySelector(
			'#referralSelector',
		) as HTMLElement;
		const error = fixture.nativeElement.querySelector(
			'#referralSelectorError',
		) as HTMLElement;

		expect(selector.tagName).toBe('BUTTON');
		expect(
			selector.querySelector('.referral-selector-question'),
		).toBeTruthy();
		expect(
			selector.querySelector('.referral-selector-required'),
		).toBeTruthy();
		expect(selector.querySelector('.referral-selector-value')).toBeTruthy();
		expect(selector.getAttribute('aria-required')).toBeNull();
		expect(selector.getAttribute('aria-haspopup')).toBe('dialog');
		expect(selector.getAttribute('aria-describedby')).toBe(
			'referralSelectorError',
		);
		expect(error).toBeTruthy();

	});

	it('only onboards after the customer confirms a supplied email address', async (): Promise<void> => {
		const alertController = TestBed.inject(
			AlertController,
		) as unknown as Mocked<AlertController>;
		const pageService = fixture.debugElement.injector.get(
			SignUpPageService,
		) as Mocked<SignUpPageService>;
		const alert = {
			present: vi.fn().mockResolvedValue(undefined),
			onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm' }),
		};
		alertController.create.mockResolvedValue(alert as never);
		component.form.controls.emailAddress.setValue('parent@example.com');
		vi.spyOn(pageService, 'onboardUser').mockResolvedValue(undefined);

		await component.onCreateAccount();

		expect(alert.present).toHaveBeenCalledOnce();
		expect(pageService.onboardUser).toHaveBeenCalledOnce();
	});

	it('does not show confirmation or onboard without an email address', async (): Promise<void> => {
		const alertController = TestBed.inject(
			AlertController,
		) as unknown as Mocked<AlertController>;
		const pageService = fixture.debugElement.injector.get(
			SignUpPageService,
		) as Mocked<SignUpPageService>;
		vi.spyOn(pageService, 'onboardUser').mockResolvedValue(undefined);
		component.form.controls.emailAddress.setValue('');

		await component.onCreateAccount();

		expect(alertController.create).not.toHaveBeenCalled();
		expect(pageService.onboardUser).not.toHaveBeenCalled();
	});

	it('formats an Other referral and uses the selection prompt when none is chosen', (): void => {
		const translateService = TestBed.inject(
			TranslateService,
		) as Mocked<TranslateService>;
		translateService.instant.mockImplementation((key: string | string[]) => {
			const translationKey = Array.isArray(key) ? key[0] : key;
			return (
				{
					'REFERRAL.OTHER': 'Other',
					'REFERRAL.REFERRED_BY': 'How did you hear about us?',
					'REFERRAL.SELECT': 'Select an answer',
				}[translationKey] ?? translationKey
			);
		});

		expect(component.displayReferral('Other: Neighbor')).toBe('Other:  Neighbor');
		expect(component.displayReferral(undefined)).toBe('');
	});

	it('presents privacy and terms modals while recording each view', async (): Promise<void> => {
		const analytics = TestBed.inject(
			AnalyticsWrapper,
		) as Mocked<AnalyticsWrapper>;
		const logEvent = vi.spyOn(analytics, 'logEvent');
		const privacyModal = { present: vi.fn().mockResolvedValue(undefined) };
		const termsModal = { present: vi.fn().mockResolvedValue(undefined) };
		modalController.create
			.mockResolvedValueOnce(privacyModal as never)
			.mockResolvedValueOnce(termsModal as never);

		await component.showPrivacyPolicyModal();
		await component.showTermsConditionsModal();

		expect(logEvent).toHaveBeenCalledWith('viewed_privacypolicy');
		expect(logEvent).toHaveBeenCalledWith('viewed_termsofservice');
		expect(privacyModal.present).toHaveBeenCalledOnce();
		expect(termsModal.present).toHaveBeenCalledOnce();
	});

	it('exposes legal dialogs as keyboard-focusable buttons', (): void => {
		const legalButtons = Array.from(
			fixture.nativeElement.querySelectorAll('.legal-link'),
		) as HTMLButtonElement[];

		expect(legalButtons).toHaveLength(2);
		expect(legalButtons.every((button) => button.type === 'button')).toBe(true);
		expect(
			legalButtons.every(
				(button) => button.getAttribute('aria-haspopup') === 'dialog',
			),
		).toBe(true);
	});
});
