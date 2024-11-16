import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DuplicatePage } from './duplicate.page';

describe('DuplicatePage', () => {
	let component: DuplicatePage;
	let fixture: ComponentFixture<DuplicatePage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [DuplicatePage],
		}).compileComponents();

		fixture = TestBed.createComponent(DuplicatePage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
