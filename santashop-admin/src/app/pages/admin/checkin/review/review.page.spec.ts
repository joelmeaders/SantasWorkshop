import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ReviewPage } from './review.page';

describe('ReviewPage', () => {
	let component: ReviewPage;
	let fixture: ComponentFixture<ReviewPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ReviewPage],
		}).compileComponents();

		fixture = TestBed.createComponent(ReviewPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
