import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { CheckInPage } from './check-in.page';

describe('CheckInPage', () => {
	let component: CheckInPage;
	let fixture: ComponentFixture<CheckInPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [CheckInPage],
		}).compileComponents();

		fixture = TestBed.createComponent(CheckInPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
