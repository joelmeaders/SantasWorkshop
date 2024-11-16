import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RegistrationPage } from './registration.page';

describe('RegistrationPage', () => {
	let component: RegistrationPage;
	let fixture: ComponentFixture<RegistrationPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [RegistrationPage],
		}).compileComponents();

		fixture = TestBed.createComponent(RegistrationPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
