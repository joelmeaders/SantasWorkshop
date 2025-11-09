import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Analytics } from '@angular/fire/analytics';
import {
	PROGRAM_YEAR,
	FireRepoLite,
	SkeletonStateService,
} from '@santashop/core';
import {
	createAppStateServiceMock,
	provideTranslateServiceMock,
	provideActivatedRouteMock,
} from '../../../../../test-helpers';

import { DateTimePage } from './date-time.page';
import { DateTimePageService } from './date-time.page.service';
import { PreRegistrationService } from '../../../../core/services/pre-registration.service';
import { AppStateService } from '../../../../core';
import { AlertController } from '@ionic/angular/standalone';
import { of } from 'rxjs';

describe('DateTimePage', () => {
	let component: DateTimePage;
	let fixture: ComponentFixture<DateTimePage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [DateTimePage],
			providers: [
				{
					provide: DateTimePageService,
					useValue: jasmine.createSpyObj(
						'DateTimePageService',
						[''],
						{
							availableSlots$: of([]),
							registrationSlot$: of(undefined),
						},
					),
				},
				{
					provide: PreRegistrationService,
					useValue: jasmine.createSpyObj(
						'PreRegistrationService',
						[''],
						{
							userRegistration$: of(undefined),
						},
					),
				},
				{
					provide: FireRepoLite,
					useValue: {
						collection: jasmine
							.createSpy('collection')
							.and.returnValue({
								readMany: jasmine
									.createSpy('readMany')
									.and.returnValue(of([])),
							}),
						randomId: jasmine
							.createSpy('randomId')
							.and.returnValue('mock-id'),
					},
				},
				{
					provide: AppStateService,
					useFactory: createAppStateServiceMock,
				},
				{
					provide: Analytics,
					useValue: jasmine.createSpyObj('Analytics', ['logEvent']),
				},
				{
					provide: AlertController,
					useValue: jasmine.createSpyObj('AlertController', [
						'create',
					]),
				},
				{
					provide: SkeletonStateService,
					useValue: jasmine.createSpyObj('SkeletonStateService', [
						'addState',
						'removeState',
					]),
				},
				{ provide: PROGRAM_YEAR, useValue: 2025 },
				provideActivatedRouteMock(),
				provideTranslateServiceMock(),
			],
		})
			.overrideComponent(DateTimePage, {
				set: {
					providers: [],
				},
			})
			.compileComponents();

		fixture = TestBed.createComponent(DateTimePage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
