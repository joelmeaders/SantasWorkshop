import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { AnalyticsWrapper, FireRepoLite, PROGRAM_YEAR } from '@santashop/core';
import { DateTimeSlot, Registration } from '@santashop/models';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { AlertController, ToastController } from '@ionic/angular/standalone';
import {
	provideTranslateServiceMock,
	provideAuthMock,
	provideFirestoreMock,
	provideFunctionsMock,
	provideStorageMock,
	provideActivatedRouteMock,
	provideAnalyticsMock,
} from '../../../../test-helpers';
import { OverviewPage } from './overview.page';
import { ChildrenCardComponent } from './children-card/children-card.component';
import { ScheduleCardComponent } from './schedule-card/schedule-card.component';
import { SubmitCardComponent } from './submit-card/submit-card.component';
import { PreRegistrationService } from '../../../core';
import en from '../../../../assets/i18n/en.json';
import es from '../../../../assets/i18n/es.json';

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
	const childCount = new BehaviorSubject(0);
	const dateTimeSlot = new BehaviorSubject<DateTimeSlot | undefined>(
		undefined,
	);
	const registrationComplete = new BehaviorSubject(false);
	const registrationSubmitted = new BehaviorSubject(false);
	const userRegistration = new BehaviorSubject<Registration | undefined>(
		undefined,
	);
	const preregistrationService = {
		userRegistration$: userRegistration.asObservable(),
		children$: of([]),
		childCount$: childCount.asObservable(),
		dateTimeSlot$: dateTimeSlot.asObservable(),
		registrationComplete$: registrationComplete.asObservable(),
		registrationSubmitted$: registrationSubmitted.asObservable(),
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
		childCount.next(0);
		dateTimeSlot.next(undefined);
		registrationComplete.next(false);
		registrationSubmitted.next(false);
		preregistrationService.setDraftAppointment.mockReset();
		preregistrationService.setDraftAppointment.mockResolvedValue({
			data: true,
		});
		preregistrationService.completeRegistration.mockReset();
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

	it.each([
		['en', en],
		['es', es],
	] as const)(
		'preserves the draft and opens selection with the real %s recovery text',
		async (_language, catalog) => {
			childCount.next(1);
			dateTimeSlot.next({
				id: 'slot-1',
				dateTime: new Date('2025-12-10T18:00:00.000Z'),
			} as DateTimeSlot);
			await fixture.whenStable();
			const translate = TestBed.inject(TranslateService);
			vi.mocked(translate.instant).mockImplementation((key) =>
				key === 'OVERVIEW.APPOINTMENT_REVIEW_REQUIRED'
					? catalog.OVERVIEW.APPOINTMENT_REVIEW_REQUIRED
					: 'translated',
			);
			preregistrationService.completeRegistration.mockRejectedValue({
				details: { reason: 'appointment-review-required' },
			});
			await component.submitRegistration();
			expect(toastController.create).toHaveBeenLastCalledWith(
				expect.objectContaining({
					message: catalog.OVERVIEW.APPOINTMENT_REVIEW_REQUIRED,
					color: 'danger',
				}),
			);
			expect(childCount.value).toBe(1);
			expect(dateTimeSlot.value?.id).toBe('slot-1');
			expect(component.reviewing()).toBe(false);
			const schedule = fixture.debugElement.query(
				By.directive(ScheduleCardComponent),
			).componentInstance as ScheduleCardComponent;
			expect(schedule.expanded()).toBe(true);
		},
	);

	it('retains the completion ID after an uncertain response and converges on a later committed snapshot', async () => {
		const router = TestBed.inject(Router);
		const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
		preregistrationService.completeRegistration.mockRejectedValue(
			new Error('Response lost'),
		);
		await component.submitRegistration();
		await component.submitRegistration();
		expect(
			preregistrationService.completeRegistration.mock.calls[1][0]
				.mutationId,
		).toBe(
			preregistrationService.completeRegistration.mock.calls[0][0]
				.mutationId,
		);
		registrationSubmitted.next(true);
		await fixture.whenStable();
		expect(navigate).toHaveBeenCalledWith([
			'/pre-registration/confirmation',
		]);
		registrationSubmitted.next(false);
		userRegistration.next(undefined);
		await fixture.whenStable();
		await component.submitRegistration();
		expect(
			preregistrationService.completeRegistration.mock.calls[2][0]
				.mutationId,
		).not.toBe(
			preregistrationService.completeRegistration.mock.calls[0][0]
				.mutationId,
		);
	});

	it('exits review when the tab resumes and requires fresh server validation to review again', async () => {
		childCount.next(1);
		dateTimeSlot.next({
			id: 'slot-1',
			dateTime: new Date('2025-12-10T18:00:00.000Z'),
		} as DateTimeSlot);
		await component.startReview();
		expect(component.reviewing()).toBe(true);
		window.dispatchEvent(new Event('online'));
		expect(component.reviewing()).toBe(false);
		await component.startReview();
		expect(
			preregistrationService.setDraftAppointment,
		).toHaveBeenCalledTimes(2);
		expect(
			preregistrationService.setDraftAppointment,
		).toHaveBeenLastCalledWith(
			expect.objectContaining({
				slotId: 'slot-1',
				reviewedDateTime: '2025-12-10T18:00:00.000Z',
			}),
		);
	});

	it('clears a pending completion identity when the authenticated registration changes', async () => {
		userRegistration.next({ uid: 'first-user' } as Registration);
		await fixture.whenStable();
		preregistrationService.completeRegistration.mockRejectedValue(
			new Error('Response lost'),
		);
		await component.submitRegistration();
		userRegistration.next(undefined);
		await fixture.whenStable();
		userRegistration.next({ uid: 'second-user' } as Registration);
		await fixture.whenStable();
		await component.submitRegistration();
		expect(
			preregistrationService.completeRegistration.mock.calls[1][0]
				.mutationId,
		).not.toBe(
			preregistrationService.completeRegistration.mock.calls[0][0]
				.mutationId,
		);
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

		expect(TestBed.inject(TranslateService).instant).toHaveBeenCalledWith(
			'OVERVIEW.CHILD_SAVED',
		);
		expect(alertController.create).toHaveBeenCalled();
		expect(toastController.create).toHaveBeenCalledWith(
			expect.objectContaining({
				message: 'translated',
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

	it('validates child age against the configured program year', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2040, 0, 1));
		try {
			await component.saveChild({
				isNew: false,
				child: {
					id: 789,
					firstName: 'Robin',
					lastName: 'Snow',
					dateOfBirth: new Date(2014, 0, 1),
					ageGroup: '9-11' as never,
					toyType: 'girls' as never,
					programYearAdded: 2025,
					enabled: true,
				},
			});

			expect(
				preregistrationService.saveDraftChild,
			).toHaveBeenCalledOnce();
		} finally {
			vi.useRealTimers();
		}
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

		dateTimeSlot.next({
			id: 'slot-1',
			dateTime: new Date('2025-12-10T18:00:00.000Z'),
		} as DateTimeSlot);
		await component.startReview();
		await fixture.whenStable();

		expect(component.reviewing()).toBe(true);
		expect(childrenCard.editorOpen()).toBe(false);
		expect(scheduleCard.expanded()).toBe(false);
		expect(
			fixture.nativeElement.querySelector(
				'app-children-card ion-card-content',
			),
		).toBeNull();
		expect(
			fixture.nativeElement.querySelector(
				'app-schedule-card ion-card-content',
			),
		).toBeNull();

		component.makeChanges();
		await fixture.whenStable();

		expect(component.reviewing()).toBe(false);
		expect(
			fixture.nativeElement.querySelector(
				'app-children-card ion-card-content',
			),
		).not.toBeNull();
		expect(
			fixture.nativeElement.querySelector(
				'app-schedule-card ion-card-content',
			),
		).not.toBeNull();
	});

	it('draws attention to the final step and opens review when selected', async (): Promise<void> => {
		childCount.next(1);
		dateTimeSlot.next({
			id: 'slot-1',
			enabled: true,
			dateTime: new Date('2025-12-10T18:00:00.000Z'),
		} as DateTimeSlot);
		await fixture.whenStable();

		const nudge = fixture.nativeElement.querySelector(
			'.completion-nudge',
		) as HTMLElement;
		const action = fixture.nativeElement.querySelector(
			'#reviewAndSubmitButton',
		) as HTMLIonButtonElement;
		expect(nudge).toBeTruthy();
		expect(action).toBeTruthy();

		action.click();
		await fixture.whenStable();

		const submitCard = fixture.debugElement.query(
			By.directive(SubmitCardComponent),
		).componentInstance as SubmitCardComponent;
		expect(component.reviewing()).toBe(true);
		expect(submitCard.expanded()).toBe(true);
		expect(
			fixture.nativeElement.querySelector('.completion-nudge'),
		).toBeNull();
	});

	it('saves an enabled appointment and rejects unavailable selections', async (): Promise<void> => {
		preregistrationService.setDraftAppointment.mockResolvedValue({
			data: true,
		});

		await component.chooseDateTime({
			id: 'slot-1',
			dateTime: new Date('2026-12-20T18:00:00.000Z'),
			enabled: true,
		} as DateTimeSlot);
		await component.chooseDateTime({
			id: 'slot-2',
			enabled: false,
		} as DateTimeSlot);
		await component.chooseDateTime();

		expect(preregistrationService.setDraftAppointment).toHaveBeenCalledWith(
			expect.objectContaining({ slotId: 'slot-1' }),
		);
		expect(toastController.create).toHaveBeenCalledWith(
			expect.objectContaining({
				message: 'translated',
				color: 'success',
			}),
		);
		expect(toastController.create).toHaveBeenCalledWith(
			expect.objectContaining({
				message: 'translated',
				color: 'danger',
			}),
		);
		expect(TestBed.inject(TranslateService).instant).toHaveBeenCalledWith(
			'OVERVIEW.APPOINTMENT_UNAVAILABLE',
		);
	});

	it('navigates after a successful submission and keeps the workspace open on failure', async (): Promise<void> => {
		const router = TestBed.inject(Router);
		const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
		preregistrationService.completeRegistration.mockResolvedValue({
			data: true,
		});

		const submission = component.submitRegistration();
		await Promise.resolve();
		expect(navigate).not.toHaveBeenCalled();
		registrationComplete.next(true);
		await submission;

		expect(navigate).toHaveBeenCalledWith([
			'/pre-registration/confirmation',
		]);
		registrationComplete.next(false);
		preregistrationService.completeRegistration.mockResolvedValue({
			data: false,
		});
		await component.submitRegistration();
		expect(toastController.create).toHaveBeenLastCalledWith(
			expect.objectContaining({ color: 'danger' }),
		);
	});
});
