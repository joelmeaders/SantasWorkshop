import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ByNamePage } from './by-name.page';

describe('ByNamePage', () => {
	let component: ByNamePage;
	let fixture: ComponentFixture<ByNamePage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ByNamePage],
		}).compileComponents();

		fixture = TestBed.createComponent(ByNamePage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
