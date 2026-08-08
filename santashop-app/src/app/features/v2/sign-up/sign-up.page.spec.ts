import {
	beforeEach,
	describe,
	expect,
	it,
	type Mocked,
	vi,
} from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, AlertController } from '@ionic/angular';
import {
	provideTranslateServiceMock,
	createModalControllerMock,
	createAppStateServiceMock,
	provideAnalyticsMock,
	provideAuthMock,
	provideFunctionsMock,
	provideActivatedRouteMock,
} from '../../../../test-helpers';
import { SignUpPage } from './sign-up.page';
import { SignUpPageService } from './sign-up.page.service';
import { newOnboardUserForm } from './sign-up.form';
import { AppStateService } from '@santashop/core';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AnalyticsWrapper } from '@santashop/core';

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
				provideAnalyticsMock(),
				provideAuthMock(),
				provideFunctionsMock(),
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

		expect(component.form.controls.referredBy.value).toBe('Friend');
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

	it('exposes the referral question, answer, required state, and error description accessibly', async () => {
		const translateService = TestBed.inject(
			TranslateService,
		) as Mocked<TranslateService>;
		translateService.instant.mockImplementation((key: string | string[]) => {
			const translations: Record<string, string> = {
				'REFERRAL.REFERRED_BY': 'How did you hear about us?',
				'REFERRAL.SELECT': 'Select an answer',
			};
			const translationKey = Array.isArray(key) ? key[0] : key;
			return translations[translationKey] ?? translationKey;
		});

		component.form.controls.referredBy.markAsTouched();
		await fixture.whenStable();

		const selector = fixture.nativeElement.querySelector(
			'#referralSelector',
		) as HTMLElement;
		const error = fixture.nativeElement.querySelector(
			'#referralSelectorError',
		) as HTMLElement;

		expect(selector.getAttribute('aria-label')).toBe(
			'How did you hear about us? Select an answer',
		);
		expect(selector.getAttribute('aria-required')).toBe('true');
		expect(selector.getAttribute('aria-describedby')).toBe(
			'referralSelectorError',
		);
		expect(error).toBeTruthy();

		expect(component.referralAriaLabel('School')).toBe(
			'How did you hear about us? School',
		);
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
		expect(component.referralAriaLabel(undefined)).toBe(
			'How did you hear about us? Select an answer',
		);
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
});
