import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
	provideActivatedRouteMock,
	provideCustomerAuthMock,
	provideFirestoreMock,
	provideCustomerFunctionsMock,
	provideCustomerStorageMock,
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
				provideCustomerAuthMock(),
				provideCustomerFunctionsMock(),
				provideCustomerStorageMock(),
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

	it('offsets routed content below the header and mobile safe area', (): void => {
		document.documentElement.style.setProperty('--ion-safe-area-top', '62px');
		try {
			const outlet = fixture.nativeElement.querySelector(
				'ion-router-outlet#main',
			) as HTMLElement;
			expect(getComputedStyle(outlet).top).toBe('139px');
		} finally {
			document.documentElement.style.removeProperty('--ion-safe-area-top');
		}
	});
});
