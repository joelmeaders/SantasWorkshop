import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ModalController, AlertController } from '@ionic/angular/standalone';
import {
	provideTranslateServiceMock,
	createModalControllerMock,
	createAppStateServiceMock,
	provideAnalyticsMock,
	provideAuthMock,
	provideFunctionsMock,
	provideActivatedRouteMock,
} from '../../../../test-helpers';
import { SignUpPage } from './sign-up.page';
import { SignUpPageService } from './sign-up.page.service';
import { AppStateService } from '@santashop/core';
import { of } from 'rxjs';

describe('SignUpPage', () => {
	let component: SignUpPage;
	let fixture: ComponentFixture<SignUpPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [SignUpPage],
			providers: [
				{
					provide: SignUpPageService,
					useValue: jasmine.createSpyObj(
						'SignUpPageService',
						['onboardUser'],
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
				{
					provide: AlertController,
					useValue: jasmine.createSpyObj('AlertController', [
						'create',
					]),
				},
				{
					provide: ModalController,
					useValue: createModalControllerMock(),
				},
				provideTranslateServiceMock(),
				provideActivatedRouteMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(SignUpPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
