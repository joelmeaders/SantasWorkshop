import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { UserPage } from './user.page';
import {
	provideFirestoreWrapperMock,
	provideActivatedRouteMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('UserPage', () => {
	let component: UserPage;
	let fixture: ComponentFixture<UserPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [UserPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideActivatedRouteMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(UserPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
