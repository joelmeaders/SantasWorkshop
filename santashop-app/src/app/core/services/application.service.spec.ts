import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { ModalController } from '@ionic/angular/standalone';
import { AppStateService } from '@santashop/core';
import {
	createModalControllerMock,
	createAppStateServiceMock,
} from '../../../test-helpers';
import { ApplicationService } from './application.service';

describe('ApplicationService', () => {
	let service: ApplicationService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				{
					provide: Firestore,
					useValue: jasmine.createSpyObj('Firestore', [
						'collection',
						'doc',
					]),
				},
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
