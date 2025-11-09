import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ReviewPage } from './review.page';
import {
	provideFirestoreWrapperMock,
	provideFunctionsMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('ReviewPage', () => {
	let component: ReviewPage;
	let fixture: ComponentFixture<ReviewPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ReviewPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideFunctionsMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ReviewPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
