import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DateTimePage } from './date-time.page';

describe('DateTimePage', () => {
	let component: DateTimePage;
	let fixture: ComponentFixture<DateTimePage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [DateTimePage],
		}).compileComponents();

		fixture = TestBed.createComponent(DateTimePage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
