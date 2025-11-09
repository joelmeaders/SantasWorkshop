import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CheckInPage } from './check-in.page';
import {
	provideFirestoreWrapperMock,
	provideActivatedRouteMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('CheckInPage', () => {
	let component: CheckInPage;
	let fixture: ComponentFixture<CheckInPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [CheckInPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideActivatedRouteMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(CheckInPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
