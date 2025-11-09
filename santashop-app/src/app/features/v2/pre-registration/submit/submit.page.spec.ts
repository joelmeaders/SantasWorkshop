import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Analytics } from '@angular/fire/analytics';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Storage } from '@angular/fire/storage';
import {
	provideActivatedRouteMock,
	provideTranslateServiceMock,
	createAuthMock,
	createFirestoreMock,
	createAnalyticsMock,
} from '../../../../../test-helpers';
import { SubmitPage } from './submit.page';

describe('SubmitPage', () => {
	let component: SubmitPage;
	let fixture: ComponentFixture<SubmitPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [SubmitPage],
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
				{
					provide: Analytics,
					useFactory: createAnalyticsMock,
				},
				provideActivatedRouteMock(),
				provideTranslateServiceMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(SubmitPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
