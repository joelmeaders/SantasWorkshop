import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
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
} from '@ionic/angular/standalone';
import { AppStateService, ErrorHandlerService } from '@santashop/core';
import { of } from 'rxjs';
import { DateTimePageService } from '../date-time/date-time.page.service';
import { PreRegistrationService } from '../../../../core/services/pre-registration.service';

import { ConfirmationPage } from './confirmation.page';

describe('ConfirmationPage', () => {
	let component: ConfirmationPage;
	let fixture: ComponentFixture<ConfirmationPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ConfirmationPage],
			providers: [
				provideAnalyticsMock(),
				{
					provide: PreRegistrationService,
					useValue: {
						registrationComplete$: of(false),
						hasCheckedIn$: of(false),
						dateTimeSlot$: of(undefined),
						undoRegistration: jasmine
							.createSpy('undoRegistration')
							.and.resolveTo(undefined),
						changeRegistrationDateTime: jasmine
							.createSpy('changeRegistrationDateTime')
							.and.resolveTo(undefined),
					},
				},
				{
					provide: DateTimePageService,
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
					useValue: jasmine.createSpyObj('ErrorHandlerService', [
						'handleError',
					]),
				},
				{
					provide: ModalController,
					useValue: createModalControllerMock(),
				},
				{
					provide: LoadingController,
					useValue: jasmine.createSpyObj('LoadingController', [
						'create',
					]),
				},
				{
					provide: AlertController,
					useValue: jasmine.createSpyObj('AlertController', [
						'create',
					]),
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
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
