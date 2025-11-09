import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Analytics } from '@angular/fire/analytics';
import { Functions } from '@angular/fire/functions';
import {
	createAppStateServiceMock,
	createAuthMock,
	provideActivatedRouteMock,
	provideTranslateServiceMock,
	createAnalyticsMock,
} from '../../../../test-helpers';
import { SignInPage } from './sign-in.page';
import { SignInPageService } from './sign-in.page.service';
import { AppStateService } from '@santashop/core';
import { of } from 'rxjs';

describe('SignInPage', () => {
	let component: SignInPage;
	let fixture: ComponentFixture<SignInPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [SignInPage],
			providers: [
				{
					provide: SignInPageService,
					useValue: jasmine.createSpyObj(
						'SignInPageService',
						['signIn'],
						{
							email$: of(''),
							password$: of(''),
						},
					),
				},
				{
					provide: AppStateService,
					useFactory: createAppStateServiceMock,
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
				provideActivatedRouteMock(),
				provideTranslateServiceMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(SignInPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
