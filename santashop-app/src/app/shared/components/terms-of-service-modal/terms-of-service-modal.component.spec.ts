import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TermsOfServiceModalComponent } from './terms-of-service-modal.component';

describe('TermsOfServiceModalComponent', () => {
	let component: TermsOfServiceModalComponent;
	let fixture: ComponentFixture<TermsOfServiceModalComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [TermsOfServiceModalComponent],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(TermsOfServiceModalComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
