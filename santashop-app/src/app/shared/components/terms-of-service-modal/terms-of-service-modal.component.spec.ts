import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
	ModalController,
	provideIonicAngular,
} from '@ionic/angular/standalone';
import {
	createModalControllerMock,
	provideTranslateServiceMock,
} from '../../../../test-helpers';

import { TermsOfServiceModalComponent } from './terms-of-service-modal.component';

describe('TermsOfServiceModalComponent', () => {
	let component: TermsOfServiceModalComponent;
	let fixture: ComponentFixture<TermsOfServiceModalComponent>;

	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [TermsOfServiceModalComponent],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
			providers: [
				provideIonicAngular(),
				{
					provide: ModalController,
					useValue: createModalControllerMock(),
				},
				provideTranslateServiceMock(),
			],
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(TermsOfServiceModalComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
