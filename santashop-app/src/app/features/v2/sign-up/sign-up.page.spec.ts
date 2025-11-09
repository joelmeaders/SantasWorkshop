import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Analytics } from '@angular/fire/analytics';
import { Auth } from '@angular/fire/auth';
import { Functions } from '@angular/fire/functions';
import { ModalController, AlertController } from '@ionic/angular/standalone';
import {
	provideTranslateServiceMock,
	createModalControllerMock,
	createAppStateServiceMock,
	createAuthMock,
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
