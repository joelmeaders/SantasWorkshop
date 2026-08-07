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
});
