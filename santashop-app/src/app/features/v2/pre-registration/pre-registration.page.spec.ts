import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { PreRegistrationPage } from './pre-registration.page';

describe('PreRegistrationPage', () => {
	let component: PreRegistrationPage;
	let fixture: ComponentFixture<PreRegistrationPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [PreRegistrationPage],
		}).compileComponents();

		fixture = TestBed.createComponent(PreRegistrationPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
