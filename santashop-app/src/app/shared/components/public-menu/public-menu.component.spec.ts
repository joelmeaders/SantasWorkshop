import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ModalController, PopoverController } from '@ionic/angular';
import {
	createPopoverControllerMock,
	createModalControllerMock,
	provideTranslateServiceMock,
	provideCustomerAnalyticsMock,
	provideCustomerAuthMock,
	provideCustomerFunctionsMock,
} from '../../../../test-helpers';
import { PublicMenuComponent } from './public-menu.component';

describe('PublicMenuComponent', () => {
	let component: PublicMenuComponent;
	let fixture: ComponentFixture<PublicMenuComponent>;
	const router = { navigate: vi.fn().mockResolvedValue(true) };

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PublicMenuComponent],
			providers: [
				provideCustomerAuthMock(),
				provideCustomerFunctionsMock(),
				provideCustomerAnalyticsMock(),
				{
					provide: PopoverController,
					useValue: createPopoverControllerMock(),
				},
				{
					provide: ModalController,
					useValue: createModalControllerMock(),
				},
				{ provide: Router, useValue: router },
				provideTranslateServiceMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(PublicMenuComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('navigates account actions, opens help, and saves the selected language', async (): Promise<void> => {
		const popover = TestBed.inject(PopoverController) as any;
		const modal = TestBed.inject(ModalController) as any;
		popover.dismiss.mockResolvedValue(undefined);
		modal.create.mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) });

		await component.home();
		await component.profile();
		await component.signIn();
		await component.help();
		await component.setLanguage('es');

		expect(router.navigate).toHaveBeenNthCalledWith(1, ['/']);
		expect(router.navigate).toHaveBeenNthCalledWith(2, ['/pre-registration/profile']);
		expect(router.navigate).toHaveBeenNthCalledWith(3, ['/'], { queryParams: { mode: 'sign-in' } });
		expect(modal.create).toHaveBeenCalledOnce();
		expect(window.localStorage.getItem('santashop-language')).toBe('es');
		expect(popover.dismiss).toHaveBeenCalledTimes(5);
	});
});
