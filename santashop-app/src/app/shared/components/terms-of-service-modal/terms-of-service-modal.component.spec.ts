import { beforeEach, describe, expect, it } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
	ModalController,
	provideIonicAngular,
} from '@ionic/angular';
import {
	createModalControllerMock,
	provideTranslateServiceMock,
} from '../../../../test-helpers';

import { TermsOfServiceModalComponent } from './terms-of-service-modal.component';

describe('TermsOfServiceModalComponent', () => {
	let component: TermsOfServiceModalComponent;
	let fixture: ComponentFixture<TermsOfServiceModalComponent>;

	beforeEach(async () => {
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

	beforeEach(async () => {
		fixture = TestBed.createComponent(TermsOfServiceModalComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
