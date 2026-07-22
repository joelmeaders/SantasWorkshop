import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {
	provideAnalyticsMock,
	provideAuthMock,
	provideFunctionsMock,
	provideActivatedRouteMock,
	provideTranslateServiceMock,
} from '../../../../test-helpers';
import { ResetPasswordPage } from './reset-password.page';

describe('ResetPasswordPage', () => {
	let component: ResetPasswordPage;
	let fixture: ComponentFixture<ResetPasswordPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ResetPasswordPage],
			providers: [
				provideAuthMock(),
				provideFunctionsMock(),
				provideAnalyticsMock(),
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
