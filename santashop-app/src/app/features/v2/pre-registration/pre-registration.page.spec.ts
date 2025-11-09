import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Storage } from '@angular/fire/storage';
import {
	provideActivatedRouteMock,
	createAuthMock,
} from '../../../../test-helpers';

import { PreRegistrationPage } from './pre-registration.page';

describe('PreRegistrationPage', () => {
	let component: PreRegistrationPage;
	let fixture: ComponentFixture<PreRegistrationPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [PreRegistrationPage],
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
					useValue: createAuthMock(),
				},
				{
					provide: Functions,
					useValue: jasmine.createSpyObj('Functions', [
						'httpsCallable',
					]),
				},
				{
					provide: Storage,
					useValue: jasmine.createSpyObj('Storage', ['ref']),
				},
				provideActivatedRouteMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(PreRegistrationPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
