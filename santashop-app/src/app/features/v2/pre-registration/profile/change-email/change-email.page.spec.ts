import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Analytics } from '@angular/fire/analytics';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Storage } from '@angular/fire/storage';
import {
	provideTranslateServiceMock,
	provideActivatedRouteMock,
	createAuthMock,
	createFirestoreMock,
} from '../../../../../../test-helpers';

import { ChangeEmailPage } from './change-email.page';

describe('ChangeEmailPage', () => {
	let component: ChangeEmailPage;
	let fixture: ComponentFixture<ChangeEmailPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ChangeEmailPage],
			providers: [
				{
					provide: Firestore,
					useFactory: createFirestoreMock,
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
				{
					provide: Analytics,
					useValue: jasmine.createSpyObj('Analytics', ['logEvent']),
				},
				{
					provide: Storage,
					useValue: jasmine.createSpyObj('Storage', ['ref']),
				},
				provideTranslateServiceMock(),
				provideActivatedRouteMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ChangeEmailPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
