import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ChangePasswordPage } from './change-password.page';

describe('ChangePasswordPage', () => {
	let component: ChangePasswordPage;
	let fixture: ComponentFixture<ChangePasswordPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ChangePasswordPage],
		}).compileComponents();

		fixture = TestBed.createComponent(ChangePasswordPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
