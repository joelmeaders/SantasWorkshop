import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import en from '../../../../assets/i18n/en.json';
import es from '../../../../assets/i18n/es.json';
import {
	provideActivatedRouteMock,
	createModalControllerMock,
	provideAnalyticsMock,
} from '../../../../test-helpers';
import {
	AlertController,
	LoadingController,
	ModalController,
} from '@ionic/angular/standalone';
import { AnalyticsWrapper, AppStateService, ErrorHandlerService } from '@santashop/core';
import { BehaviorSubject, of } from 'rxjs';
import { DateTimeSlotsService } from './date-time-slots.service';
import { PreRegistrationService } from '../../../core/services/pre-registration.service';

import { ConfirmationPage } from './confirmation.page';

describe('ConfirmationPage', () => {
	let component: ConfirmationPage;
	let fixture: ComponentFixture<ConfirmationPage>;
	const checkedIn$ = new BehaviorSubject<boolean | undefined>(false);
	const registrationComplete$ = new BehaviorSubject<boolean>(true);
	const slot$ = new BehaviorSubject<any>({
		id: 'slot-1', dateTime: new Date('2026-12-20T10:00:00'), enabled: true,
	});
	const children$ = new BehaviorSubject<any[]>([
		{ id: 'child-1', firstName: 'Holly', lastName: 'Jolly', toyType: 'girls', dateOfBirth: new Date('2020-01-01') },
		{ id: 'child-2', firstName: 'Nick', lastName: 'Kringle', toyType: 'boys', dateOfBirth: new Date('2019-01-01') },
		{ id: 'child-3', firstName: 'Noel', lastName: 'Bell', toyType: 'infants', dateOfBirth: new Date('2025-01-01') },
	]);

	beforeEach(async () => {
		registrationComplete$.next(true);
		TestBed.configureTestingModule({
			imports: [ConfirmationPage],
			providers: [
				provideAnalyticsMock(),
				{
					provide: PreRegistrationService,
					useValue: {
						hasCheckedIn$: checkedIn$,
						dateTimeSlot$: slot$,
						children$,
						registrationComplete$: registrationComplete$,
						qrCode$: of(
							'data:image/svg+xml,' +
								encodeURIComponent(
									'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"></svg>',
								),
						),
						undoRegistration: vi
							.fn()
							.mockName('undoRegistration')
							.mockResolvedValue(undefined),
						changeRegistrationDateTime: vi
							.fn()
							.mockName('changeRegistrationDateTime')
							.mockResolvedValue(undefined),
					},
				},
				{
					provide: DateTimeSlotsService,
					useValue: {
						availableSlots$: of([]),
					},
				},
				{
					provide: AppStateService,
					useValue: {
						allowChangeRegistration$: of(true),
						allowCancelRegistration$: of(true),
					},
				},
				{
					provide: ErrorHandlerService,
					useValue: {
						handleError: vi
							.fn()
							.mockName('ErrorHandlerService.handleError'),
					},
				},
				{
					provide: ModalController,
					useValue: createModalControllerMock(),
				},
				{
					provide: LoadingController,
					useValue: {
						create: vi.fn().mockName('LoadingController.create'),
					},
				},
				{
					provide: AlertController,
					useValue: {
						create: vi.fn().mockName('AlertController.create'),
					},
				},
				provideRouter([
					{ path: 'pre-registration/confirmation', component: ConfirmationPage },
				]),
				provideTranslateService(),
				provideActivatedRouteMock(),
			],
		})
			.overrideComponent(ConfirmationPage, {
				set: {
					providers: [],
				},
			})
			.compileComponents();
		const translate = TestBed.inject(TranslateService);
		translate.setTranslation('en', en);
		translate.setTranslation('es', es);
		translate.use('en');
		fixture = TestBed.createComponent(ConfirmationPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it.each(['en', 'es'])(
		'scrolls the Ionic ticket to event details on repeated mobile clicks in %s',
		async (language): Promise<void> => {
			const viewport = {
				width: window.innerWidth,
				height: window.innerHeight,
			};
			try {
				await page.viewport(390, 844);
				TestBed.inject(TranslateService).use(language);
				await TestBed.inject(Router).navigateByUrl(
					'/pre-registration/confirmation',
				);
				const host = fixture.nativeElement as HTMLElement;
				// Match the viewport bounds supplied by the routed page container.
				host.style.cssText =
					'position: fixed; inset: 0; display: flex; flex-direction: column;';
				await fixture.whenStable();
				const content = host.querySelector('ion-content') as HTMLIonContentElement;
				const scrollElement = await content.getScrollElement();
				const details = host.querySelector('#event-information') as HTMLElement;
				const heading = details.querySelector('h2') as HTMLElement;
				const button = host.querySelector('#eventInformationButton') as HTMLIonButtonElement;
				expect(button.textContent).toContain(
					(language === 'es' ? es : en).CONFIRMATION.EVENT_INFORMATION,
				);
				for (let attempt = 0; attempt < 2; attempt++) {
					await content.scrollToTop(0);
					expect(scrollElement.scrollTop).toBe(0);
					expect(details.getBoundingClientRect().top).toBeGreaterThan(
						scrollElement.getBoundingClientRect().bottom,
					);
					await page.elementLocator(button).click();
					await vi.waitFor(() => {
						expect(scrollElement.scrollTop).toBeGreaterThan(0);
						const bounds = heading.getBoundingClientRect();
						const visible = scrollElement.getBoundingClientRect();
						expect(bounds.top).toBeGreaterThanOrEqual(visible.top);
						expect(bounds.bottom).toBeLessThanOrEqual(visible.bottom);
						expect(document.activeElement).toBe(details);
					}, { timeout: 3000 });
				}
			} finally {
				await page.viewport(viewport.width, viewport.height);
			}
		},
	);

	it('renders the registered slot, children, and available ticket actions', async (): Promise<void> => {
		await fixture.whenStable();

		expect(fixture.nativeElement.querySelector('#registrationQrCode')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('#changeRegistrationButton')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('#cancelRegistrationButton')).toBeTruthy();
		expect(fixture.nativeElement.querySelectorAll('.children-ticket-list ion-item')).toHaveLength(4);
	});

	it('keeps permission actions disabled while check-in state is unresolved', async (): Promise<void> => {
		checkedIn$.next(undefined);
		await fixture.whenStable();
		expect(component.allowChangeRegistration()).toBe(false);
		expect(component.allowCancelRegistration()).toBe(false);

		checkedIn$.next(false);
		await fixture.whenStable();
		expect(component.allowChangeRegistration()).toBe(true);
		expect(component.allowCancelRegistration()).toBe(true);
	});

	it('confirms cancellation and changes an appointment through the customer workflow', async (): Promise<void> => {
		const alertController = TestBed.inject(AlertController) as any;
		const loadingController = TestBed.inject(LoadingController) as any;
		const modalController = TestBed.inject(ModalController) as any;
		const router = TestBed.inject(Router) as any;
		const preRegistration = TestBed.inject(PreRegistrationService) as any;
		const loader = { present: vi.fn().mockResolvedValue(undefined), dismiss: vi.fn().mockResolvedValue(undefined) };
		alertController.create
			.mockResolvedValueOnce({ present: vi.fn().mockResolvedValue(undefined), onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm' }) })
			.mockResolvedValueOnce({ present: vi.fn().mockResolvedValue(undefined), onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm' }) })
			.mockResolvedValueOnce({ present: vi.fn().mockResolvedValue(undefined) });
		loadingController.create.mockResolvedValue(loader);
		modalController.create.mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined), onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm', data: { id: 'next-slot' } }) });
		router.navigate = vi.fn().mockResolvedValue(true);

		const analytics = TestBed.inject(AnalyticsWrapper);
		const events = vi.spyOn(analytics, 'logEvent');
		const outcomes = vi.spyOn(analytics, 'logEventWithParams');
		const cancellation = component.undoRegistration();
		await vi.waitFor(() =>
			expect(preRegistration.undoRegistration).toHaveBeenCalledOnce(),
		);
		expect(router.navigate).not.toHaveBeenCalled();
		registrationComplete$.next(false);
		await cancellation;
		await component.changeRegistration();

		expect(preRegistration.undoRegistration).toHaveBeenCalledOnce();
		expect(preRegistration.changeRegistrationDateTime).toHaveBeenCalledWith({ id: 'next-slot' });
		expect(router.navigate).toHaveBeenCalledWith(['/pre-registration/overview']);
		expect(loader.dismiss).toHaveBeenCalledTimes(2);
		expect(events).toHaveBeenCalledWith('cancel_registration');
		expect(events).toHaveBeenCalledWith('change_registration_datetime');
		expect(outcomes).toHaveBeenCalledWith('workflow_action', { operation: 'registration_cancel', outcome: 'succeeded' });
		expect(outcomes).toHaveBeenCalledWith('workflow_action', { operation: 'appointment_change', outcome: 'succeeded' });
	});

	it('handles a cancellation failure without navigating', async (): Promise<void> => {
		const alertController = TestBed.inject(AlertController) as any;
		const loadingController = TestBed.inject(LoadingController) as any;
		const errorHandler = TestBed.inject(ErrorHandlerService) as any;
		const router = TestBed.inject(Router) as any;
		const preRegistration = TestBed.inject(PreRegistrationService) as any;
		const loader = {
			present: vi.fn().mockResolvedValue(undefined),
			dismiss: vi.fn().mockResolvedValue(undefined),
		};
		const cancellationError = new Error('cancellation failed');
		alertController.create.mockResolvedValue({
			present: vi.fn().mockResolvedValue(undefined),
			onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm' }),
		});
		loadingController.create.mockResolvedValue(loader);
		preRegistration.undoRegistration.mockRejectedValueOnce(cancellationError);
		router.navigate = vi.fn().mockResolvedValue(true);

		const events = vi.spyOn(TestBed.inject(AnalyticsWrapper), 'logEvent');
		const outcomes = vi.spyOn(TestBed.inject(AnalyticsWrapper), 'logEventWithParams');
		await component.undoRegistration();
		expect(events).not.toHaveBeenCalledWith('cancel_registration');
		expect(outcomes).toHaveBeenCalledWith('workflow_action', { operation: 'registration_cancel', outcome: 'failed', error_code: 'unknown' });

		expect(errorHandler.handleError).toHaveBeenCalledWith(cancellationError);
		expect(router.navigate).not.toHaveBeenCalled();
		expect(loader.dismiss).toHaveBeenCalledOnce();
	});
});
