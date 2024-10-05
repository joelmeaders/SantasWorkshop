import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ChangeEmailPage } from './change-email.page';

describe('ChangeEmailPage', () => {
	let component: ChangeEmailPage;
	let fixture: ComponentFixture<ChangeEmailPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ChangeEmailPage],
		}).compileComponents();

		fixture = TestBed.createComponent(ChangeEmailPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
