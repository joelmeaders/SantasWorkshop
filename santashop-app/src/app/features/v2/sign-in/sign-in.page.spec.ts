import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {
	createAppStateServiceMock,
	provideAnalyticsMock,
	provideAuthMock,
	provideFunctionsMock,
	provideActivatedRouteMock,
	provideTranslateServiceMock,
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
				provideAuthMock(),
				provideFunctionsMock(),
				provideAnalyticsMock(),
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
