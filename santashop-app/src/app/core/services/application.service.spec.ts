import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { AppStateService } from '@santashop/core';
import {
	createModalControllerMock,
	createAppStateServiceMock,
	provideFirestoreMock,
} from '../../../test-helpers';
import { ApplicationService } from './application.service';

describe('ApplicationService', () => {
	let service: ApplicationService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideFirestoreMock(),
				{
					provide: ModalController,
					useValue: createModalControllerMock(),
				},
				{
					provide: AppStateService,
					useFactory: createAppStateServiceMock,
				},
			],
		});
		service = TestBed.inject(ApplicationService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
