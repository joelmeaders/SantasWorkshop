import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Analytics } from '@angular/fire/analytics';
import { Auth } from '@angular/fire/auth';
import { Functions } from '@angular/fire/functions';
import {
	provideActivatedRouteMock,
	provideTranslateServiceMock,
	createAnalyticsMock,
	createAuthMock,
} from '../../../../test-helpers';
import { ResetPasswordPage } from './reset-password.page';

describe('ResetPasswordPage', () => {
	let component: ResetPasswordPage;
	let fixture: ComponentFixture<ResetPasswordPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ResetPasswordPage],
			providers: [
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
		fixture = TestBed.createComponent(ResetPasswordPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
