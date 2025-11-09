import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Analytics } from '@angular/fire/analytics';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Storage } from '@angular/fire/storage';
import {
	provideTranslateServiceMock,
	createAuthMock,
	createFirestoreMock,
	provideActivatedRouteMock,
	createAnalyticsMock,
} from '../../../../../../test-helpers';
import { ChangeInfoPage } from './change-info.page';

describe('ChangeInfoPage', () => {
	let component: ChangeInfoPage;
	let fixture: ComponentFixture<ChangeInfoPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ChangeInfoPage],
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
					useFactory: createAnalyticsMock,
				},
				{
					provide: Storage,
					useValue: jasmine.createSpyObj('Storage', ['ref']),
				},
				provideTranslateServiceMock(),
				provideActivatedRouteMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ChangeInfoPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
