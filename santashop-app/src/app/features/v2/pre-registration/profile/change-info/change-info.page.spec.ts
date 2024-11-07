import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ChangeInfoPage } from './change-info.page';

describe('ChangeInfoPage', () => {
	let component: ChangeInfoPage;
	let fixture: ComponentFixture<ChangeInfoPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ChangeInfoPage],
		}).compileComponents();

		fixture = TestBed.createComponent(ChangeInfoPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
