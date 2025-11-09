import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { PreRegistrationPage } from './pre-registration.page';
import {
	provideFirestoreWrapperMock,
	provideFunctionsMock,
	provideModalControllerMock,
	provideAlertControllerMock,
	provideLoadingControllerMock,
	provideActivatedRouteMock,
} from '../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('PreRegistrationPage', () => {
	let component: PreRegistrationPage;
	let fixture: ComponentFixture<PreRegistrationPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [PreRegistrationPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideFunctionsMock(),
				provideModalControllerMock(),
				provideAlertControllerMock(),
				provideLoadingControllerMock(),
				provideActivatedRouteMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(PreRegistrationPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
