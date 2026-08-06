import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AnalyticsWrapper, FireRepoLite, PROGRAM_YEAR } from '@santashop/core';
import { DateTimeSlot } from '@santashop/models';
import { Observable, of } from 'rxjs';
import { AlertController, ToastController } from '@ionic/angular/standalone';
import {
	provideTranslateServiceMock,
	provideAuthMock,
	provideFirestoreMock,
	provideFunctionsMock,
	provideStorageMock,
	provideActivatedRouteMock,
	provideAnalyticsMock,
} from '../../../../../test-helpers';
import { OverviewPage } from './overview.page';
import { ChildrenCardComponent } from './children-card/children-card.component';
import { PreRegistrationService } from '../../../../core';

describe('OverviewPage', () => {
	let component: OverviewPage;
	let fixture: ComponentFixture<OverviewPage>;
	const alert = jasmine.createSpyObj('HTMLIonAlertElement', [
		'present',
		'onDidDismiss',
	]);
	const alertController = jasmine.createSpyObj<AlertController>(
		'AlertController',
		['create'],
	);
	const toast = jasmine.createSpyObj('HTMLIonToastElement', ['present']);
	const toastController = jasmine.createSpyObj<ToastController>(
		'ToastController',
		['create', 'dismiss'],
	);
	const preregistrationService = {
		userRegistration$: of(undefined),
		children$: of([]),
		childCount$: of(0),
		dateTimeSlot$: of(undefined),
		registrationSubmitted$: of(false),
		noErrorsInChildren$: of(true),
		saveDraftChild: jasmine.createSpy('saveDraftChild'),
		deleteDraftChild: jasmine.createSpy('deleteDraftChild'),
		setDraftAppointment: jasmine.createSpy('setDraftAppointment'),
		completeRegistration: jasmine.createSpy('completeRegistration'),
	};

	beforeEach(waitForAsync(() => {
		alert.present.calls.reset();
		alert.onDidDismiss.calls.reset();
		alertController.create.calls.reset();
		toast.present.calls.reset();
		toastController.create.calls.reset();
		toastController.dismiss.calls.reset();
		preregistrationService.saveDraftChild.calls.reset();
		preregistrationService.saveDraftChild.and.resolveTo({ data: true });
		alert.present.and.resolveTo();
		alert.onDidDismiss.and.resolveTo({ role: 'cancel' });
		alertController.create.and.resolveTo(alert);
		toast.present.and.resolveTo();
		toastController.create.and.resolveTo(toast);
		toastController.dismiss.and.resolveTo(false);
		TestBed.configureTestingModule({
			imports: [OverviewPage],
			providers: [
				provideFirestoreMock(),
				provideAuthMock(),
				provideFunctionsMock(),
				provideStorageMock(),
				provideActivatedRouteMock(),
				provideTranslateServiceMock(),
				provideAnalyticsMock(),
				provideRouter([]),
				{ provide: AlertController, useValue: alertController },
				{ provide: ToastController, useValue: toastController },
				{
					provide: AnalyticsWrapper,
					useValue: jasmine.createSpyObj('AnalyticsWrapper', [
						'logEvent',
						'logEventWithParams',
					]),
				},
				{ provide: PreRegistrationService, useValue: preregistrationService },
				{
					provide: FireRepoLite,
					useValue: {
						collection: (): { readMany: () => Observable<DateTimeSlot[]> } => ({
							readMany: () => of([]),
						}),
					},
				},
				{ provide: PROGRAM_YEAR, useValue: 2025 },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(OverviewPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('asks about another child after a new child is saved and collapses on No', async () => {
		await component.saveChild({
			isNew: true,
			child: {
				id: 123,
				firstName: 'Taylor',
				lastName: 'Snow',
				dateOfBirth: new Date('2020-01-02T00:00:00.000Z'),
				ageGroup: '3-5' as never,
				toyType: 'girls' as never,
				programYearAdded: 2025,
				enabled: true,
			},
		});

		expect(alertController.create).toHaveBeenCalled();
		expect(toastController.create).toHaveBeenCalledWith(
			jasmine.objectContaining({
				message: 'Child saved. You can now choose an appointment.',
				color: 'success',
			}),
		);
		expect(toast.present).toHaveBeenCalled();
		expect(alert.present).toHaveBeenCalled();
		expect(alert.onDidDismiss).toHaveBeenCalled();
		const childrenCard = fixture.debugElement.query(
			By.directive(ChildrenCardComponent),
		).componentInstance as ChildrenCardComponent;
		expect(childrenCard.editorOpen()).toBeFalse();
	});

	it('presents action failures as danger toasts', async () => {
		preregistrationService.saveDraftChild.and.rejectWith(
			new Error('Unable to save child.'),
		);

		await component.saveChild({
			isNew: false,
			child: {
				id: 456,
				firstName: 'Jamie',
				lastName: 'Frost',
				dateOfBirth: new Date('2021-02-03T00:00:00.000Z'),
				ageGroup: '3-5' as never,
				toyType: 'boys' as never,
				programYearAdded: 2025,
				enabled: true,
			},
		});

		expect(toastController.create).toHaveBeenCalledWith(
			jasmine.objectContaining({
				message: 'Unable to save child.',
				color: 'danger',
			}),
		);
		expect(alertController.create).not.toHaveBeenCalled();
	});
});
