import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SignUpPage } from './sign-up.page';

describe('SignUpPage', () => {
	let component: SignUpPage;
	let fixture: ComponentFixture<SignUpPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [SignUpPage],
		}).compileComponents();

		fixture = TestBed.createComponent(SignUpPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
