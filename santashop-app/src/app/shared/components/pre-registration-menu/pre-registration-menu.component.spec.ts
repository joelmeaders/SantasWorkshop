import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { PreRegistrationMenuComponent } from './pre-registration-menu.component';

describe('PreRegistrationMenuComponent', () => {
	let component: PreRegistrationMenuComponent;
	let fixture: ComponentFixture<PreRegistrationMenuComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [PreRegistrationMenuComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(PreRegistrationMenuComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
