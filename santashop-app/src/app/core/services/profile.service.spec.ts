import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
	let service: ProfileService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				{
					provide: Auth,
					useValue: jasmine.createSpyObj('Auth', [
						'signInWithEmailAndPassword',
					]),
				},
				{
					provide: Firestore,
					useValue: jasmine.createSpyObj('Firestore', [
						'collection',
						'doc',
					]),
				},
				{
					provide: Functions,
					useValue: jasmine.createSpyObj('Functions', [
						'httpsCallable',
					]),
				},
			],
		});
		service = TestBed.inject(ProfileService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
