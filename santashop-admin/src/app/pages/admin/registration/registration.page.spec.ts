import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistrationPage } from './registration.page';
import { provideActivatedRouteMock } from '../../../../test-helpers';
import { provideRouter, Router } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular/standalone';
import { CheckInContextService } from '../../../shared/services/check-in-context.service';
import { CheckInService } from '../../../shared/services/check-in.service';

describe('RegistrationPage', () => {
	let component: RegistrationPage;
	let fixture: ComponentFixture<RegistrationPage>;
	const onSiteRegistration = vi.fn();
	const setCheckIn = vi.fn();
	const reset = vi.fn();
	const modal = {
		present: vi.fn().mockResolvedValue(undefined),
		onDidDismiss: vi.fn().mockResolvedValue({ data: undefined }),
	};
	const createModal = vi.fn().mockResolvedValue(modal);
	const alert = {
		present: vi.fn().mockResolvedValue(undefined),
		onDidDismiss: vi.fn().mockResolvedValue(undefined),
	};
	const createAlert = vi.fn().mockResolvedValue(alert);

	beforeEach(async () => {
		onSiteRegistration.mockReset();
		setCheckIn.mockReset();
		reset.mockReset();
		modal.present.mockClear();
		modal.onDidDismiss.mockReset();
		modal.onDidDismiss.mockResolvedValue({ data: undefined });
		createModal.mockClear();
		alert.present.mockClear();
		alert.onDidDismiss.mockReset();
		alert.onDidDismiss.mockResolvedValue(undefined);
		createAlert.mockClear();
		TestBed.configureTestingModule({
			imports: [RegistrationPage],
			providers: [
				{ provide: CheckInService, useValue: { onSiteRegistration } },
				{
					provide: CheckInContextService,
					useValue: { setCheckIn, reset },
				},
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

	it('provides programmatic labels for guardian fields', () => {
		const inputs = fixture.nativeElement.querySelectorAll(
			'form > ion-item ion-input',
		) as NodeListOf<HTMLIonInputElement>;

		expect([...inputs].map((input) => input.label)).toEqual([
			'First Name',
			'Last Name',
			'Email',
			'Zip Code',
		]);
	});

	it('maintains children and records a referral selected through the modal', async () => {
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
		expect(component.form.controls['referral'].value).toBe('School flyer');
		expect(component.chosenReferrer()).toBe('School flyer');
	});

	it('registers an on-site family and routes a successful check-in to confirmation', async () => {
		component.form.patchValue({
			firstName: 'Ada',
			lastName: 'Lovelace',
			emailAddress: 'ada@example.test',
			zipCode: '80001',
			referral: 'Friend',
		});
		await component.addChild({ id: 1, firstName: 'Ava' } as never);
		onSiteRegistration.mockResolvedValue(4);
		const navigate = vi
			.spyOn(TestBed.inject(Router), 'navigate')
			.mockResolvedValue(true);

		await component.checkIn();

		expect(onSiteRegistration).toHaveBeenCalledWith(
			expect.objectContaining({
				uid: 'onsite',
				qrcode: 'onsite',
				children: [{ id: 1, firstName: 'Ava' }],
			}),
		);
		expect(setCheckIn).toHaveBeenCalledWith(4, 'onsite');
		expect(navigate).toHaveBeenCalledWith(['/admin/checkin/confirmation']);
	});

	it('routes capacity conflicts to the duplicate screen', async () => {
		onSiteRegistration.mockRejectedValue({ details: { code: 6 } });
		const navigate = vi
			.spyOn(TestBed.inject(Router), 'navigate')
			.mockResolvedValue(true);

		await component.checkIn();

		expect(reset).toHaveBeenCalledOnce();
		expect(navigate).toHaveBeenCalledWith([
			'/admin/checkin/duplicate',
			'onsite',
		]);
	});

	it('keeps an uncertain submission available for recovery', async () => {
		onSiteRegistration.mockRejectedValue({
			code: 'unavailable',
			message: 'Try later',
		});
		const navigate = vi
			.spyOn(TestBed.inject(Router), 'navigate')
			.mockResolvedValue(true);

		await component.checkIn();

		expect(createAlert).toHaveBeenCalledWith(
			expect.objectContaining({
				header: 'Error registering',
				subHeader: 'code: unavailable',
				message: expect.stringContaining('Retry to recover'),
			}),
		);
		expect(reset).toHaveBeenCalledOnce();
		expect(navigate).not.toHaveBeenCalled();
	});

	it('clears its form and local state when leaving the page', async () => {
		component.form.controls['firstName'].setValue('Ada');
		await component.addChild({ id: 1 } as never);
		component.ionViewWillLeave();

		expect(component.form.controls['firstName'].value).toBeNull();
		expect(component.children()).toEqual([]);
		expect(component.chosenReferrer()).toBe('None Selected');
	});
	it('retains the submission across lost responses and blocks concurrent clicks', async () => {
		vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		let reject!: (error: Error) => void;
		onSiteRegistration.mockImplementationOnce(
			() =>
				new Promise((_resolve, fail) => {
					reject = fail;
				}),
		);
		const first = component.checkIn();
		await component.checkIn();
		expect(onSiteRegistration).toHaveBeenCalledTimes(1);
		const original = onSiteRegistration.mock.calls[0][0];
		expect(original.mutationId).toEqual(expect.any(String));
		reject(new Error('Response lost'));
		await first;
		onSiteRegistration.mockResolvedValue(1);
		await component.checkIn();
		expect(onSiteRegistration.mock.calls[1][0]).toEqual(original);
		component.reset();
		await component.checkIn();
		expect(onSiteRegistration.mock.calls[2][0].mutationId).not.toBe(
			original.mutationId,
		);
	});
	it('allows correction after a definite validation rejection with a new submission ID', async () => {
		vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		onSiteRegistration
			.mockRejectedValueOnce({
				code: 'functions/invalid-argument',
				message: 'Invalid family details',
			})
			.mockResolvedValue(1);
		await component.checkIn();
		const oldId = onSiteRegistration.mock.calls[0][0].mutationId;
		expect(component.form.enabled).toBe(true);
		expect(createAlert).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringContaining(
					'Correct the registration details',
				),
			}),
		);
		await component.checkIn();
		expect(onSiteRegistration.mock.calls[1][0].mutationId).not.toBe(oldId);
	});
	it('keeps the successful submission locked until confirmation navigation finishes', async () => {
		let finish!: (value: boolean) => void;
		const navigate = vi
			.spyOn(TestBed.inject(Router), 'navigate')
			.mockResolvedValue(true)
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve;
					}),
			);
		onSiteRegistration.mockResolvedValue(1);
		const first = component.checkIn();
		await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());
		try {
			await component.checkIn();
			expect(onSiteRegistration).toHaveBeenCalledTimes(1);
		} finally {
			finish(true);
			await first;
		}
	});
	it('reuses the saved submission if navigation fails after the backend succeeds', async () => {
		vi.spyOn(TestBed.inject(Router), 'navigate')
			.mockRejectedValueOnce(new Error('Navigation failed'))
			.mockResolvedValue(true);
		onSiteRegistration.mockResolvedValue(1);
		await component.checkIn();
		await component.checkIn();
		expect(onSiteRegistration.mock.calls[1][0].mutationId).toBe(
			onSiteRegistration.mock.calls[0][0].mutationId,
		);
	});
});
