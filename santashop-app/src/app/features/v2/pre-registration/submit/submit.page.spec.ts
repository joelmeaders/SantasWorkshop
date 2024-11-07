import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SubmitPage } from './submit.page';

describe('SubmitPage', () => {
	let component: SubmitPage;
	let fixture: ComponentFixture<SubmitPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [SubmitPage],
		}).compileComponents();

		fixture = TestBed.createComponent(SubmitPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
