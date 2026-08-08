import { beforeEach, describe, expect, it, type Mocked } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import {
	createModalControllerMock,
	provideTranslateServiceMock,
} from '../../../../test-helpers';

import { PrivacyPolicyModalComponent } from './privacy-policy-modal.component';

describe('PrivacyPolicyModalComponent', () => {
	let component: PrivacyPolicyModalComponent;
	let fixture: ComponentFixture<PrivacyPolicyModalComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PrivacyPolicyModalComponent],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
			providers: [
				{
					provide: ModalController,
					useValue: createModalControllerMock(),
				},
				provideTranslateServiceMock(),
			],
		}).compileComponents();
	});

	beforeEach(async () => {
		fixture = TestBed.createComponent(PrivacyPolicyModalComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('dismisses the modal from the close control', (): void => {
		const modalController = TestBed.inject(
			ModalController,
		) as Mocked<ModalController>;

		component.onDismiss();

		expect(modalController.dismiss).toHaveBeenCalledOnce();
	});
});
