import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { SignInPage } from './sign-in.page';
import {
	provideAuthMock,
	provideAlertControllerMock,
	provideFunctionsMock,
} from '../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('SignInPage', () => {
	let component: SignInPage;
	let fixture: ComponentFixture<SignInPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [SignInPage],
			providers: [
				provideAuthMock(),
				provideAlertControllerMock(),
				provideFunctionsMock(),
				provideRouter([]),
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
