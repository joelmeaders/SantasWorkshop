import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
	provideTranslateServiceMock,
	provideActivatedRouteMock,
	createModalControllerMock,
	provideAnalyticsMock,
} from '../../../../../test-helpers';
import {
	AlertController,
	LoadingController,
	ModalController,
} from '@ionic/angular';
import { AppStateService, ErrorHandlerService } from '@santashop/core';
import { BehaviorSubject, of } from 'rxjs';
import { DateTimeSlotsService } from './date-time-slots.service';
import { PreRegistrationService } from '../../../../core/services/pre-registration.service';

import { ConfirmationPage } from './confirmation.page';

describe('ConfirmationPage', () => {
	let component: ConfirmationPage;
	let fixture: ComponentFixture<ConfirmationPage>;
	const checkedIn$ = new BehaviorSubject(false);
	const slot$ = new BehaviorSubject<any>({
		id: 'slot-1', dateTime: new Date('2026-12-20T10:00:00'), enabled: true,
	});
	const children$ = new BehaviorSubject<any[]>([
		{ id: 'child-1', firstName: 'Holly', lastName: 'Jolly', toyType: 'girls', dateOfBirth: new Date('2020-01-01') },
		{ id: 'child-2', firstName: 'Nick', lastName: 'Kringle', toyType: 'boys', dateOfBirth: new Date('2019-01-01') },
		{ id: 'child-3', firstName: 'Noel', lastName: 'Bell', toyType: 'infants', dateOfBirth: new Date('2025-01-01') },
	]);

	beforeEach(async () => {
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
						qrCode$: of('data:image/png;base64,test'),
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
				provideRouter([]),
				provideTranslateServiceMock(),
				provideActivatedRouteMock(),
			],
		})
			.overrideComponent(ConfirmationPage, {
				set: {
					providers: [],
				},
			})
			.compileComponents();
		fixture = TestBed.createComponent(ConfirmationPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('renders the registered slot, children, and available ticket actions', async (): Promise<void> => {
		await fixture.whenStable();

		expect(fixture.nativeElement.querySelector('#registrationQrCode')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('#changeRegistrationButton')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('#cancelRegistrationButton')).toBeTruthy();
		expect(fixture.nativeElement.querySelectorAll('.children-ticket-list ion-item')).toHaveLength(4);
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

		await component.undoRegistration();
		await component.changeRegistration();

		expect(preRegistration.undoRegistration).toHaveBeenCalledOnce();
		expect(preRegistration.changeRegistrationDateTime).toHaveBeenCalledWith({ id: 'next-slot' });
		expect(router.navigate).toHaveBeenCalledWith(['/pre-registration/overview']);
		expect(loader.dismiss).toHaveBeenCalledTimes(2);
	});
});
