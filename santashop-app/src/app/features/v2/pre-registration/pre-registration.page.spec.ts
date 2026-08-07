import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
	provideActivatedRouteMock,
	provideAuthMock,
	provideFirestoreMock,
	provideFunctionsMock,
	provideStorageMock,
	createPopoverControllerMock,
	provideTranslateServiceMock,
} from '../../../../test-helpers';
import { PopoverController } from '@ionic/angular';

import { PreRegistrationPage } from './pre-registration.page';

describe('PreRegistrationPage', () => {
	let component: PreRegistrationPage;
	let fixture: ComponentFixture<PreRegistrationPage>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [PreRegistrationPage],
			providers: [
				provideFirestoreMock(),
				provideAuthMock(),
				provideFunctionsMock(),
				provideStorageMock(),
				provideTranslateServiceMock(),
				{
					provide: PopoverController,
					useValue: createPopoverControllerMock(),
				},
				provideActivatedRouteMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(PreRegistrationPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
