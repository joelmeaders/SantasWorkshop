import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ResetPasswordPage } from './reset-password.page';

describe('ResetPasswordPage', () => {
	let component: ResetPasswordPage;
	let fixture: ComponentFixture<ResetPasswordPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ResetPasswordPage],
		}).compileComponents();

		fixture = TestBed.createComponent(ResetPasswordPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
