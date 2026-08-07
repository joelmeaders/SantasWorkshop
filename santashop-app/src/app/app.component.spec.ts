import {
	beforeEach,
	describe,
	expect,
	it,
	type Mocked,
	vi,
} from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
	provideActivatedRouteMock,
	createTranslateServiceMock,
	createModalControllerMock,
} from '../test-helpers';

import {
	AlertController,
	Platform,
	ModalController,
} from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

import { AppComponent } from './app.component';
import { AnalyticsWrapper, AppStateService } from '@santashop/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApplicationService } from './core/services/application.service';

describe('AppComponent', () => {
	let platformSpy: Mocked<Pick<Platform, 'ready'>>;

	beforeEach(() => {
		platformSpy = {
			ready: vi
				.fn()
				.mockName('Platform.ready')
				.mockReturnValue(Promise.resolve()),
		};

		const appStateSpy = {
			globalAlert$: of({ enabled: false }),
		};

		TestBed.configureTestingModule({
			imports: [AppComponent],
			schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
			providers: [
				provideRouter([]),
				{ provide: Platform, useValue: platformSpy },
				{
					provide: TranslateService,
					useFactory: createTranslateServiceMock,
				},
				{ provide: AppStateService, useValue: appStateSpy },
				{
					provide: AnalyticsWrapper,
					useValue: {
						logEvent: vi.fn().mockName('AnalyticsWrapper.logEvent'),
						logEventWithParams: vi
							.fn()
							.mockName('AnalyticsWrapper.logEventWithParams'),
						logErrorEvent: vi
							.fn()
							.mockName('AnalyticsWrapper.logErrorEvent'),
					},
				},
				{
					provide: ApplicationService,
					useValue: {},
				},
				{
					provide: AlertController,
					useValue: {
						create: vi.fn().mockName('AlertController.create'),
					},
				},
				{
					provide: ModalController,
					useValue: createModalControllerMock(),
				},
				provideActivatedRouteMock(),
			],
		})
			.overrideComponent(AppComponent, {
				set: { imports: [] },
			})
			.compileComponents();
	});

	it('should create the app', () => {
		const fixture = TestBed.createComponent(AppComponent);
		const app = fixture.debugElement.componentInstance;
		expect(app).toBeTruthy();
	});

	it('should initialize the app', async () => {
		const fixture = TestBed.createComponent(AppComponent);
		await fixture.whenStable();
		expect(platformSpy.ready).toHaveBeenCalled();
	});
});
