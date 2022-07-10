import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { TestpagePageModule } from './testpage.module';

import { TestpagePage } from './testpage.page';

describe('TestpagePage', () => {
	let component: TestpagePage;
	let fixture: ComponentFixture<TestpagePage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({ imports: [TestpagePageModule] })
			.overrideComponent(TestpagePage, {
				set: {
					imports: [],
				},
			})
			.compileComponents();

		fixture = TestBed.createComponent(TestpagePage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
