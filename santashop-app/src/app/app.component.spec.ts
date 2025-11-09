import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Analytics } from '@angular/fire/analytics';
import {
	provideActivatedRouteMock,
	createTranslateServiceMock,
} from '../test-helpers';

import { AlertController, Platform } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';

import { AppComponent } from './app.component';
import { AppStateService } from './core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('AppComponent', () => {
	let platformSpy: jasmine.SpyObj<Platform>;

	beforeEach(() => {
		platformSpy = jasmine.createSpyObj('Platform', {
			ready: Promise.resolve(),
		});

		const appStateSpy = jasmine.createSpyObj('AppStateService', [], {
			globalAlert$: of({ enabled: false }),
		});

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
					provide: Analytics,
					useValue: jasmine.createSpyObj('Analytics', ['']),
				},
				{
					provide: AlertController,
					useValue: jasmine.createSpyObj('AlertController', [
						'create',
					]),
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
		TestBed.createComponent(AppComponent);
		expect(platformSpy.ready).toHaveBeenCalled();
	});
});
