import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';

import { CheckedInGuard } from './checked-in.guard';

describe('CheckedInGuard', () => {
	let guard: CheckedInGuard;

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
					useValue: jasmine.createSpyObj('Auth', [
						'signInWithEmailAndPassword',
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
		guard = TestBed.inject(CheckedInGuard);
	});

	it('should be created', () => {
		expect(guard).toBeTruthy();
	});
});
