import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Storage } from '@angular/fire/storage';
import {
	provideTranslateServiceMock,
	createAuthMock,
	createFirestoreMock,
} from '../../../../test-helpers';
import { PreRegistrationMenuComponent } from './pre-registration-menu.component';

describe('PreRegistrationMenuComponent', () => {
	let component: PreRegistrationMenuComponent;
	let fixture: ComponentFixture<PreRegistrationMenuComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [PreRegistrationMenuComponent],
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
					provide: Storage,
					useValue: jasmine.createSpyObj('Storage', ['ref']),
				},
				provideTranslateServiceMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(PreRegistrationMenuComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
