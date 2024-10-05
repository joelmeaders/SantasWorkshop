import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ScanPage } from './scan.page';

describe('ScanPage', () => {
	let component: ScanPage;
	let fixture: ComponentFixture<ScanPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ScanPage],
		}).compileComponents();

		fixture = TestBed.createComponent(ScanPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
