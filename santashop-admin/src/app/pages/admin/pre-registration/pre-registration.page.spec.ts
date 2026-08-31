import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreRegistrationPage } from './pre-registration.page';
import {
	provideActivatedRouteMock,
	provideProgramYearMock,
} from '../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { AlertController, LoadingController, ModalController } from '@ionic/angular/standalone';
import { FireRepoLite, FunctionsWrapper } from '@santashop/core';
import { firstValueFrom, of } from 'rxjs';
import { SearchService } from '../search/search.service';

describe('PreRegistrationPage', () => {
	let component: PreRegistrationPage;
	let fixture: ComponentFixture<PreRegistrationPage>;
	const readMany = vi.fn();
	const availableSlots = [
		{ id: 'late', dateTime: new Date('2026-12-13T10:00:00Z') },
		{ id: 'early', dateTime: new Date('2026-12-12T10:00:00Z') },
	];
	const searchUsersByEmailAddress = vi.fn();
	const callable = vi.fn();
	const callableWrapper = vi.fn().mockReturnValue(callable);
	const loading = { present: vi.fn().mockResolvedValue(undefined), dismiss: vi.fn().mockResolvedValue(undefined) };
	const createLoading = vi.fn().mockResolvedValue(loading);
	const modal = { present: vi.fn().mockResolvedValue(undefined), onDidDismiss: vi.fn().mockResolvedValue({ data: undefined }) };
	const createModal = vi.fn().mockResolvedValue(modal);
	const alerts: { present: ReturnType<typeof vi.fn> }[] = [];
	const createAlert = vi.fn(async (): Promise<{ present: ReturnType<typeof vi.fn> }> => {
		const alert = { present: vi.fn().mockResolvedValue(undefined) };
		alerts.push(alert);
		return alert;
	});

	beforeEach(async () => {
		readMany.mockReset();
		readMany.mockReturnValue(of(availableSlots));
		searchUsersByEmailAddress.mockReset();
		searchUsersByEmailAddress.mockReturnValue(of([]));
		callable.mockReset();
		callable.mockResolvedValue({ data: 1 });
		callableWrapper.mockClear();
		loading.present.mockClear(); loading.dismiss.mockClear(); createLoading.mockClear();
		modal.present.mockClear(); modal.onDidDismiss.mockReset(); modal.onDidDismiss.mockResolvedValue({ data: undefined }); createModal.mockClear();
		alerts.length = 0; createAlert.mockClear();
		TestBed.configureTestingModule({
			imports: [PreRegistrationPage],
			providers: [
				{ provide: FireRepoLite, useValue: { collection: vi.fn().mockReturnValue({ readMany }) } },
				{ provide: FunctionsWrapper, useValue: { callableWrapper } },
				{ provide: SearchService, useValue: { searchUsersByEmailAddress } },
				{ provide: ModalController, useValue: { create: createModal } },
				{ provide: AlertController, useValue: { create: createAlert } },
				{ provide: LoadingController, useValue: { create: createLoading } },
				provideActivatedRouteMock(),
				provideProgramYearMock(2026),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(PreRegistrationPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('normalizes and sorts available slots while keeping stable slot identifiers', async () => {
		await expect(firstValueFrom(component.availableSlots$)).resolves.toMatchObject([
			{ id: 'early' }, { id: 'late' },
		]);
		expect(component.slotIndex(0, { id: 'early' } as never)).toBe('early');
		expect(component.slotIndex(0, {} as never)).toBe('');
	});

	it('manages children and uses a selected referral from the modal', async () => {
		await component.addChild({ id: 1, firstName: 'Ava' } as never);
		await component.editChild({ id: 1, firstName: 'Ada' } as never);
		await component.addChild({ id: 2, firstName: 'Noah' } as never);
		await component.removeChild(1);
		modal.onDidDismiss.mockResolvedValue({ data: 'School flyer' });

		await component.chooseReferral();

		await expect(firstValueFrom(component.children$)).resolves.toMatchObject([{ id: 2, firstName: 'Noah' }]);
		expect(component.form.controls['referredBy'].value).toBe('School flyer');
		await expect(firstValueFrom(component.chosenReferrer$)).resolves.toBe('School flyer');
	});

	it('blocks an existing customer and displays the duplicate-account warning', async () => {
		component.form.controls['emailAddress'].setValue('family@example.test');
		searchUsersByEmailAddress.mockReturnValue(of([{ uid: 'customer-1' }]));

		await expect(component.checkIfCustomerExists()).resolves.toBe(true);
		expect(createAlert).toHaveBeenCalledWith(expect.objectContaining({
			subHeader: 'This customer already has an account.',
		}));
	});

	it('submits a new registration, resets the form, and confirms completion', async () => {
		vi.spyOn(component, 'checkIfCustomerExists').mockResolvedValue(false);
		component.form.patchValue({
			firstName: 'Ada', lastName: 'Lovelace', emailAddress: 'ada@example.test',
			zipCode: '80001', referredBy: 'Friend', newsletter: true, dateTimeSlot: { id: 'slot-1' },
		});
		await component.addChild({ id: 1, firstName: 'Ava' } as never);

		await component.register();

		expect(callableWrapper).toHaveBeenCalledWith('callableAdminPreRegister');
		expect(callable).toHaveBeenCalledWith(expect.objectContaining({
			firstName: 'Ada', children: [{ id: 1, firstName: 'Ava' }],
		}));
		expect(loading.present).toHaveBeenCalledOnce();
		expect(loading.dismiss).toHaveBeenCalledOnce();
		expect(component.form.controls['firstName'].value).toBeNull();
		expect(createAlert).toHaveBeenLastCalledWith(expect.objectContaining({ header: 'Registration Complete' }));
	});

	it('shows the callable error, dismisses the loader, then resets after registration', async () => {
		vi.spyOn(component, 'checkIfCustomerExists').mockResolvedValue(false);
		callable.mockRejectedValue(new Error('Callable unavailable'));

		await component.register();

		expect(createAlert).toHaveBeenCalledWith(expect.objectContaining({
			header: 'Error registering', message: 'Callable unavailable',
		}));
		expect(loading.dismiss).toHaveBeenCalledOnce();
	});
});
