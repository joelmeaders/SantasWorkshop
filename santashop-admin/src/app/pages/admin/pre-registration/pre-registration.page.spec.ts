import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreRegistrationPage } from './pre-registration.page';
import {
	provideActivatedRouteMock,
	provideProgramYearMock,
} from '../../../../test-helpers';
import { provideRouter } from '@angular/router';
import {
	AlertController,
	LoadingController,
	ModalController,
} from '@ionic/angular/standalone';
import {
	FireRepoLite,
	FunctionsWrapper,
} from '@santashop/core/admin/firestore';
import { of } from 'rxjs';
import { SearchService } from '../search/search.service';

describe('PreRegistrationPage', () => {
	let component: PreRegistrationPage;
	let fixture: ComponentFixture<PreRegistrationPage>;
	const readMany = vi.fn();
	const availableSlots = [
		{
			id: 'late',
			dateTime: new Date('2026-12-13T10:00:00Z'),
			enabled: true,
			maxSlots: 3,
			slotsReserved: 0,
		},
		{
			id: 'early',
			dateTime: new Date('2026-12-12T10:00:00Z'),
			enabled: true,
			maxSlots: 3,
			slotsReserved: 2,
		},
		{
			id: 'full',
			dateTime: new Date('2026-12-12T12:00:00Z'),
			enabled: true,
			maxSlots: 3,
			slotsReserved: 3,
		},
	];
	const searchUsersByEmailAddress = vi.fn();
	const callable = vi.fn();
	const callableWrapper = vi.fn().mockReturnValue(callable);
	const loading = {
		present: vi.fn().mockResolvedValue(undefined),
		dismiss: vi.fn().mockResolvedValue(undefined),
	};
	const createLoading = vi.fn().mockResolvedValue(loading);
	const modal = {
		present: vi.fn().mockResolvedValue(undefined),
		onDidDismiss: vi.fn().mockResolvedValue({ data: undefined }),
	};
	const createModal = vi.fn().mockResolvedValue(modal);
	const alerts: { present: ReturnType<typeof vi.fn> }[] = [];
	const createAlert = vi.fn(
		async (): Promise<{ present: ReturnType<typeof vi.fn> }> => {
			const alert = { present: vi.fn().mockResolvedValue(undefined) };
			alerts.push(alert);
			return alert;
		},
	);

	beforeEach(async () => {
		readMany.mockReset();
		readMany.mockReturnValue(of(availableSlots));
		searchUsersByEmailAddress.mockReset();
		searchUsersByEmailAddress.mockReturnValue(of([]));
		callable.mockReset();
		callable.mockResolvedValue({ data: 1 });
		callableWrapper.mockClear();
		loading.present.mockClear();
		loading.dismiss.mockClear();
		createLoading.mockClear();
		modal.present.mockClear();
		modal.onDidDismiss.mockReset();
		modal.onDidDismiss.mockResolvedValue({ data: undefined });
		createModal.mockClear();
		alerts.length = 0;
		createAlert.mockClear();
		TestBed.configureTestingModule({
			imports: [PreRegistrationPage],
			providers: [
				{
					provide: FireRepoLite,
					useValue: {
						collection: vi.fn().mockReturnValue({ readMany }),
					},
				},
				{ provide: FunctionsWrapper, useValue: { callableWrapper } },
				{
					provide: SearchService,
					useValue: { searchUsersByEmailAddress },
				},
				{ provide: ModalController, useValue: { create: createModal } },
				{ provide: AlertController, useValue: { create: createAlert } },
				{
					provide: LoadingController,
					useValue: { create: createLoading },
				},
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

	it('sorts available slots, excludes full slots, and keeps stable identifiers', async () => {
		expect(component.availableSlots()).toMatchObject([
			{ id: 'early' },
			{ id: 'late' },
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
		await fixture.whenStable();

		expect(component.children()).toMatchObject([
			{ id: 2, firstName: 'Noah' },
		]);
		expect(fixture.nativeElement.textContent).toContain('Noah');
		expect(component.form.controls['referredBy'].value).toBe(
			'School flyer',
		);
		expect(component.chosenReferrer()).toBe('School flyer');
	});

	it('blocks duplicate registration before loading or invoking the callable', async () => {
		component.form.patchValue({
			firstName: 'Ada',
			emailAddress: 'family@example.test',
		});
		searchUsersByEmailAddress.mockReturnValue(of([{ uid: 'customer-1' }]));

		await component.register();

		expect(searchUsersByEmailAddress).toHaveBeenCalledWith(
			'family@example.test',
		);
		expect(createAlert).toHaveBeenCalledWith(
			expect.objectContaining({
				header: 'Error registering',
				subHeader: 'This customer already has an account.',
			}),
		);
		expect(createAlert).toHaveBeenCalledTimes(1);
		expect(createLoading).not.toHaveBeenCalled();
		expect(callable).not.toHaveBeenCalled();
		expect(component.form.controls['firstName'].value).toBe('Ada');
	});

	it('submits a new registration, resets the form, and confirms completion', async () => {
		vi.spyOn(component, 'checkIfCustomerExists').mockResolvedValue(false);
		component.form.patchValue({
			firstName: 'Ada',
			lastName: 'Lovelace',
			emailAddress: 'ada@example.test',
			zipCode: '80001',
			referredBy: 'Friend',
			newsletter: true,
			dateTimeSlot: { id: 'slot-1' },
		});
		await component.addChild({
			id: 1,
			firstName: 'Ava',
			dateOfBirth: new Date(2017, 2, 4),
		} as never);

		await component.register();

		expect(callableWrapper).toHaveBeenCalledWith(
			'callableAdminPreRegister',
		);
		expect(callable).toHaveBeenCalledWith(
			expect.objectContaining({
				firstName: 'Ada',
				children: [
					expect.objectContaining({
						id: 1,
						dateOfBirth: new Date('2017-03-04T00:00:00.000Z'),
					}),
				],
			}),
		);
		expect(loading.present).toHaveBeenCalledOnce();
		expect(loading.dismiss).toHaveBeenCalledOnce();
		expect(component.form.controls['firstName'].value).toBeNull();
		expect(createAlert).toHaveBeenLastCalledWith(
			expect.objectContaining({ header: 'Registration Complete' }),
		);
	});

	it('shows the callable error, dismisses the loader, and preserves the draft', async () => {
		vi.spyOn(component, 'checkIfCustomerExists').mockResolvedValue(false);
		callable.mockRejectedValue(new Error('Callable unavailable'));
		component.form.controls['firstName'].setValue('Ada');
		await component.addChild({
			id: 1,
			firstName: 'Ava',
			dateOfBirth: new Date(2017, 2, 4),
		} as never);

		await component.register();

		expect(callable).toHaveBeenCalledOnce();
		expect(createAlert).toHaveBeenCalledWith(
			expect.objectContaining({
				header: 'Error registering',
				message: 'Callable unavailable',
			}),
		);
		expect(createAlert).not.toHaveBeenCalledWith(
			expect.objectContaining({ header: 'Registration Complete' }),
		);
		expect(createAlert).toHaveBeenCalledTimes(1);
		expect(loading.dismiss).toHaveBeenCalledOnce();
		expect(component.form.controls['firstName'].value).toBe('Ada');
		expect(component.children()).toHaveLength(1);
	});
});
