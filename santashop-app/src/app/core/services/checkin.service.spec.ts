import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { createAuthMock } from '../../../test-helpers';
import { CheckinService } from './checkin.service';

describe('CheckinService', () => {
	let service: CheckinService;

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
					provide: Auth,
					useFactory: createAuthMock,
				},
				{
					provide: Functions,
					useValue: jasmine.createSpyObj('Functions', [
						'httpsCallable',
					]),
				},
			],
		});
		service = TestBed.inject(CheckinService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
