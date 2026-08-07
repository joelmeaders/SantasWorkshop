import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AnalyticsWrapper, FireRepoLite, PROGRAM_YEAR } from '@santashop/core';
import { DateTimeSlot } from '@santashop/models';
import { Observable, of } from 'rxjs';
import { AlertController, ToastController } from '@ionic/angular';
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
import { ScheduleCardComponent } from './schedule-card/schedule-card.component';
import { PreRegistrationService } from '../../../../core';

describe('OverviewPage', () => {
	let component: OverviewPage;
	let fixture: ComponentFixture<OverviewPage>;
	const alert = {
		present: vi.fn().mockName('HTMLIonAlertElement.present'),
		onDidDismiss: vi.fn().mockName('HTMLIonAlertElement.onDidDismiss'),
	};
	const alertController = {
		create: vi.fn().mockName('AlertController.create'),
	};
	const toast = {
		present: vi.fn().mockName('HTMLIonToastElement.present'),
	};
	const toastController = {
		create: vi.fn().mockName('ToastController.create'),
		dismiss: vi.fn().mockName('ToastController.dismiss'),
	};
	const preregistrationService = {
		userRegistration$: of(undefined),
		children$: of([]),
		childCount$: of(0),
		dateTimeSlot$: of(undefined),
		registrationSubmitted$: of(false),
		noErrorsInChildren$: of(true),
		saveDraftChild: vi.fn().mockName('saveDraftChild'),
		deleteDraftChild: vi.fn().mockName('deleteDraftChild'),
		setDraftAppointment: vi.fn().mockName('setDraftAppointment'),
		completeRegistration: vi.fn().mockName('completeRegistration'),
	};

	beforeEach(async () => {
		alert.present.mockClear();
		alert.onDidDismiss.mockClear();
		alertController.create.mockClear();
		toast.present.mockClear();
		toastController.create.mockClear();
		toastController.dismiss.mockClear();
		preregistrationService.saveDraftChild.mockClear();
		preregistrationService.saveDraftChild.mockResolvedValue({ data: true });
		alert.present.mockResolvedValue(undefined);
		alert.onDidDismiss.mockResolvedValue({ role: 'cancel' });
		alertController.create.mockResolvedValue(alert);
		toast.present.mockResolvedValue(undefined);
		toastController.create.mockResolvedValue(toast);
		toastController.dismiss.mockResolvedValue(false);
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
					useValue: {
						logEvent: vi.fn().mockName('AnalyticsWrapper.logEvent'),
						logEventWithParams: vi
							.fn()
							.mockName('AnalyticsWrapper.logEventWithParams'),
					},
				},
				{
					provide: PreRegistrationService,
					useValue: preregistrationService,
				},
				{
					provide: FireRepoLite,
					useValue: {
						collection: (): {
							readMany: () => Observable<DateTimeSlot[]>;
						} => ({
							readMany: () => of([]),
						}),
					},
				},
				{ provide: PROGRAM_YEAR, useValue: 2025 },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(OverviewPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

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
			expect.objectContaining({
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
		expect(childrenCard.editorOpen()).toBe(false);
	});

	it('presents action failures as danger toasts', async () => {
		preregistrationService.saveDraftChild.mockRejectedValue(
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
			expect.objectContaining({
				message: 'Unable to save child.',
				color: 'danger',
			}),
		);
		expect(alertController.create).not.toHaveBeenCalled();
	});

	it('collapses completed steps while registration is being reviewed', async () => {
		const childrenCard = fixture.debugElement.query(
			By.directive(ChildrenCardComponent),
		).componentInstance as ChildrenCardComponent;
		const scheduleCard = fixture.debugElement.query(
			By.directive(ScheduleCardComponent),
		).componentInstance as ScheduleCardComponent;
		childrenCard.editorOpen.set(true);
		scheduleCard.expanded.set(true);

		component.startReview();
		await fixture.whenStable();

		expect(component.reviewing()).toBe(true);
		expect(childrenCard.editorOpen()).toBe(false);
		expect(scheduleCard.expanded()).toBe(false);
		expect(fixture.nativeElement.querySelector('app-children-card ion-card-content')).toBeNull();
		expect(fixture.nativeElement.querySelector('app-schedule-card ion-card-content')).toBeNull();

		component.makeChanges();
		await fixture.whenStable();

		expect(component.reviewing()).toBe(false);
		expect(fixture.nativeElement.querySelector('app-children-card ion-card-content')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('app-schedule-card ion-card-content')).not.toBeNull();
	});
});
