import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Storage } from '@angular/fire/storage';
import {
	provideTranslateServiceMock,
	createAuthMock,
	createFirestoreMock,
} from '../../../../../test-helpers';
import { OverviewPage } from './overview.page';

describe('OverviewPage', () => {
	let component: OverviewPage;
	let fixture: ComponentFixture<OverviewPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [OverviewPage],
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
		fixture = TestBed.createComponent(OverviewPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
