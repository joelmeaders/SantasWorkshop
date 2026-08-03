import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ModalController, AlertController } from '@ionic/angular/standalone';
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
	let modalController: jasmine.SpyObj<ModalController>;

	beforeEach(waitForAsync(() => {
		modalController = createModalControllerMock();
		TestBed.configureTestingModule({
			imports: [SignUpPage],
			providers: [
				{
					provide: SignUpPageService,
					useValue: jasmine.createSpyObj(
						'SignUpPageService',
						['onboardUser'],
						{
							form: newOnboardUserForm(),
							email$: of(''),
							password$: of(''),
						},
					),
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
					useValue: jasmine.createSpyObj('AlertController', [
						'create',
					]),
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
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('saves a confirmed referral returned by the selection modal', async () => {
		const modal = {
			present: jasmine
				.createSpy('present')
				.and.returnValue(Promise.resolve()),
			onDidDismiss: jasmine
				.createSpy('onDidDismiss')
				.and.returnValue(
					Promise.resolve({ role: 'confirm', data: 'Friend' }),
				),
		};
		modalController.create.and.returnValue(Promise.resolve(modal as never));

		await component.showReferralModal();

		expect(component.form.controls.referredBy.value).toBe('Friend');
		expect(modalController.create).toHaveBeenCalled();
	});

	it('preserves the prior referral when the modal is cancelled', async () => {
		component.form.controls.referredBy.setValue('Friend');
		const modal = {
			present: jasmine
				.createSpy('present')
				.and.returnValue(Promise.resolve()),
			onDidDismiss: jasmine
				.createSpy('onDidDismiss')
				.and.returnValue(
					Promise.resolve({ role: 'cancel', data: undefined }),
				),
		};
		modalController.create.and.returnValue(Promise.resolve(modal as never));

		await component.showReferralModal();

		expect(component.form.controls.referredBy.value).toBe('Friend');
	});

	it('exposes the referral question, answer, required state, and error description accessibly', async () => {
		const translateService = TestBed.inject(
			TranslateService,
		) as jasmine.SpyObj<TranslateService>;
		translateService.instant.and.callFake((key: string) => {
			const translations: Record<string, string> = {
				'REFERRAL.REFERRED_BY': 'How did you hear about us?',
				'REFERRAL.SELECT': 'Select an answer',
			};
			return translations[key] ?? key;
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
