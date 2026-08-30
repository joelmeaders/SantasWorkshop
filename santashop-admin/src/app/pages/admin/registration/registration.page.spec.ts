import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistrationPage } from './registration.page';
import {
	provideActivatedRouteMock,
} from '../../../../test-helpers';
import { provideRouter, Router } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular/standalone';
import { CheckInContextService } from '../../../shared/services/check-in-context.service';
import { CheckInService } from '../../../shared/services/check-in.service';
import { firstValueFrom } from 'rxjs';

describe('RegistrationPage', () => {
	let component: RegistrationPage;
	let fixture: ComponentFixture<RegistrationPage>;
	const onSiteRegistration = vi.fn();
	const setCheckIn = vi.fn();
	const reset = vi.fn();
	const modal = { present: vi.fn().mockResolvedValue(undefined), onDidDismiss: vi.fn().mockResolvedValue({ data: undefined }) };
	const createModal = vi.fn().mockResolvedValue(modal);
	const alert = { present: vi.fn().mockResolvedValue(undefined), onDidDismiss: vi.fn().mockResolvedValue(undefined) };
	const createAlert = vi.fn().mockResolvedValue(alert);

	beforeEach(async () => {
		onSiteRegistration.mockReset(); setCheckIn.mockReset(); reset.mockReset();
		modal.present.mockClear(); modal.onDidDismiss.mockReset(); modal.onDidDismiss.mockResolvedValue({ data: undefined }); createModal.mockClear();
		alert.present.mockClear(); alert.onDidDismiss.mockReset(); alert.onDidDismiss.mockResolvedValue(undefined); createAlert.mockClear();
		TestBed.configureTestingModule({
			imports: [RegistrationPage],
			providers: [
				{ provide: CheckInService, useValue: { onSiteRegistration } },
				{ provide: CheckInContextService, useValue: { setCheckIn, reset } },
				{ provide: ModalController, useValue: { create: createModal } },
				{ provide: AlertController, useValue: { create: createAlert } },
				provideActivatedRouteMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(RegistrationPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('maintains children and records a referral selected through the modal', async () => {
		await component.addChild({ id: 1, firstName: 'Ava' } as never);
		await component.editChild({ id: 1, firstName: 'Ada' } as never);
		await component.addChild({ id: 2, firstName: 'Noah' } as never);
		await component.removeChild(1);
		modal.onDidDismiss.mockResolvedValue({ data: 'School flyer' });

		await component.chooseReferral();

		await expect(firstValueFrom(component.children$)).resolves.toMatchObject([{ id: 2, firstName: 'Noah' }]);
		expect(component.form.controls['referral'].value).toBe('School flyer');
		await expect(firstValueFrom(component.chosenReferrer$)).resolves.toBe('School flyer');
	});

	it('registers an on-site family and routes a successful check-in to confirmation', async () => {
		component.form.patchValue({ firstName: 'Ada', lastName: 'Lovelace', emailAddress: 'ada@example.test', zipCode: '80001', referral: 'Friend' });
		await component.addChild({ id: 1, firstName: 'Ava' } as never);
		onSiteRegistration.mockResolvedValue(4);
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		await component.checkIn();

		expect(onSiteRegistration).toHaveBeenCalledWith(expect.objectContaining({
			uid: 'onsite', qrcode: 'onsite', children: [{ id: 1, firstName: 'Ava' }],
		}));
		expect(setCheckIn).toHaveBeenCalledWith(4, 'onsite');
		expect(navigate).toHaveBeenCalledWith(['/admin/checkin/confirmation']);
	});

	it('routes capacity conflicts to the duplicate screen', async () => {
		onSiteRegistration.mockRejectedValue({ details: { code: 6 } });
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		await component.checkIn();

		expect(reset).toHaveBeenCalledOnce();
		expect(navigate).toHaveBeenCalledWith(['/admin/checkin/duplicate', 'onsite']);
	});

	it('shows other registration failures before returning to admin', async () => {
		onSiteRegistration.mockRejectedValue({ code: 'unavailable', message: 'Try later' });
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		await component.checkIn();

		expect(createAlert).toHaveBeenCalledWith(expect.objectContaining({
			header: 'Error registering', subHeader: 'code: unavailable', message: 'Try later',
		}));
		expect(reset).toHaveBeenCalledOnce();
		expect(navigate).toHaveBeenCalledWith(['/admin']);
	});

	it('clears its form and local state when leaving the page', async () => {
		component.form.controls['firstName'].setValue('Ada');
		await component.addChild({ id: 1 } as never);
		component.ionViewWillLeave();

		expect(component.form.controls['firstName'].value).toBeNull();
		await expect(firstValueFrom(component.children$)).resolves.toEqual([]);
		await expect(firstValueFrom(component.chosenReferrer$)).resolves.toBe('None Selected');
	});
});
