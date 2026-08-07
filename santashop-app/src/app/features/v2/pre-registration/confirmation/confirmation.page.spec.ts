import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
import { of } from 'rxjs';
import { DateTimeSlotsService } from './date-time-slots.service';
import { PreRegistrationService } from '../../../../core/services/pre-registration.service';

import { ConfirmationPage } from './confirmation.page';

describe('ConfirmationPage', () => {
	let component: ConfirmationPage;
	let fixture: ComponentFixture<ConfirmationPage>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [ConfirmationPage],
			providers: [
				provideAnalyticsMock(),
				{
					provide: PreRegistrationService,
					useValue: {
						hasCheckedIn$: of(false),
						dateTimeSlot$: of(undefined),
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
});
