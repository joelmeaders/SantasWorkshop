import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { RegistrationPage } from './registration.page';
import {
	provideFirestoreWrapperMock,
	provideActivatedRouteMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('RegistrationPage', () => {
	let component: RegistrationPage;
	let fixture: ComponentFixture<RegistrationPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [RegistrationPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideActivatedRouteMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(RegistrationPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
