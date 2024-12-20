import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ByCodePage } from './by-code.page';

describe('ByCodePage', () => {
	let component: ByCodePage;
	let fixture: ComponentFixture<ByCodePage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ByCodePage],
		}).compileComponents();

		fixture = TestBed.createComponent(ByCodePage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
