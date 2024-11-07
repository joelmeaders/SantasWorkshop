import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { OverviewPage } from './overview.page';

describe('OverviewPage', () => {
	let component: OverviewPage;
	let fixture: ComponentFixture<OverviewPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [OverviewPage],
		}).compileComponents();

		fixture = TestBed.createComponent(OverviewPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
