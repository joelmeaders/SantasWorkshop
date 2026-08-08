import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReviewPage } from './review.page';
import {
	provideActivatedRouteMock,
} from '../../../../../test-helpers';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AlertController, ModalController } from '@ionic/angular';
import { AppStateService, FunctionsWrapper } from '@santashop/core';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';
import { CheckInService } from '../../../../shared/services/check-in.service';
import { LookupService } from '../../../../shared/services/lookup.service';

const registration = (): Record<string, unknown> => ({
	uid: 'customer-1',
	qrcode: 'ABCDEFGH',
	emailAddress: 'family@example.test',
	children: [{ id: 1, firstName: 'Ava' }],
	dateTimeSlot: { id: 'slot-1', dateTime: new Date('2026-12-10T10:00:00Z') },
});

describe('ReviewPage', () => {
	let component: ReviewPage;
	let fixture: ComponentFixture<ReviewPage>;
	let currentRegistration: BehaviorSubject<Record<string, unknown>>;
	const setRegistration = vi.fn();
	const setCheckIn = vi.fn();
	const setBlockedScan = vi.fn();
	const reset = vi.fn();
	const checkIn = vi.fn();
	const callable = vi.fn();
	const callableWrapper = vi.fn().mockReturnValue(callable);
	const alert = {
		present: vi.fn().mockResolvedValue(undefined),
		onDidDismiss: vi.fn().mockResolvedValue({ role: 'cancel' }),
	};
	const createAlert = vi.fn().mockResolvedValue(alert);
	const modal = {
		present: vi.fn().mockResolvedValue(undefined),
		onDidDismiss: vi.fn().mockResolvedValue({ data: undefined }),
	};
	const createModal = vi.fn().mockResolvedValue(modal);

	beforeEach(async () => {
		currentRegistration = new BehaviorSubject(registration());
		setRegistration.mockReset();
		setCheckIn.mockReset();
		setBlockedScan.mockReset();
		reset.mockReset();
		checkIn.mockReset();
		callable.mockReset();
		callable.mockResolvedValue({ data: true });
		callableWrapper.mockClear();
		alert.present.mockClear();
		alert.onDidDismiss.mockReset();
		alert.onDidDismiss.mockResolvedValue({ role: 'cancel' });
		createAlert.mockClear();
		modal.present.mockClear();
		modal.onDidDismiss.mockReset();
		modal.onDidDismiss.mockResolvedValue({ data: undefined });
		createModal.mockClear();
		TestBed.configureTestingModule({
			imports: [ReviewPage],
			providers: [
				provideActivatedRouteMock(),
				{
					provide: CheckInContextService,
					useValue: {
						currentRegistration$: currentRegistration,
						inputMethod$: of('manual'),
						setRegistration,
						setCheckIn,
						setBlockedScan,
						resetRegistration: vi.fn(),
						reset,
					},
				},
				{ provide: LookupService, useValue: { getRegistrationByQrCode$: vi.fn(() => of(undefined)) } },
				{ provide: CheckInService, useValue: { checkIn } },
				{
					provide: AppStateService,
					useValue: { checkinEnabled$: of(true), allowCancelRegistration$: of(true) },
				},
				{ provide: FunctionsWrapper, useValue: { callableWrapper } },
				{ provide: AlertController, useValue: { create: createAlert } },
				{ provide: ModalController, useValue: { create: createModal } },
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ReviewPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('updates children in the current review registration', async () => {
		await component.removeChild(1);
		await component.addChild({ id: 2, firstName: 'Noah' } as never);
		await component.editChild({ id: 2, firstName: 'Nora' } as never);

		expect(setRegistration).toHaveBeenCalledTimes(3);
		expect((currentRegistration.value as { children: { id: number; firstName: string }[] }).children)
			.toEqual([{ id: 2, firstName: 'Nora' }]);
		expect(component.wasEdited).toBe(true);
	});

	it('cancels a confirmed reservation and returns to the landing page', async () => {
		alert.onDidDismiss.mockResolvedValue({ role: 'confirm' });
		callable.mockResolvedValue({ data: 1 });
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		await component.cancelReservation();

		expect(callableWrapper).toHaveBeenCalledWith('undoRegistration');
		expect(callable).toHaveBeenCalledWith({
			mutationId: expect.any(String),
			uid: 'customer-1',
		});
		expect(navigate).toHaveBeenCalledWith(['admin/landing']);
	});

	it('applies a selected date-time slot and marks the review as edited', async () => {
		const newSlot = { id: 'slot-2', dateTime: new Date('2026-12-11T11:00:00Z') };
		modal.onDidDismiss.mockResolvedValue({ data: newSlot });

		await component.editDateTime();

		expect(createModal).toHaveBeenCalledOnce();
		expect(callableWrapper).toHaveBeenCalledWith('changeRegistrationDateTime');
		expect(callable).toHaveBeenCalledWith({
			mutationId: expect.any(String),
			slotId: 'slot-2',
			registrationUid: 'customer-1',
		});
		expect(component.wasEdited).toBe(true);
	});

	it('removes a date-time slot when the modal explicitly returns no selection', async () => {
		modal.onDidDismiss.mockResolvedValue({ data: null });

		await component.editDateTime();

		expect(callable).not.toHaveBeenCalled();
		expect((currentRegistration.value as { dateTimeSlot?: unknown }).dateTimeSlot).toBeUndefined();
		expect(setRegistration).toHaveBeenCalledWith(currentRegistration.value);
		expect(component.wasEdited).toBe(true);
	});

	it('presents a date-time error without mutating the selected slot', async () => {
		const newSlot = { id: 'slot-2', dateTime: new Date('2026-12-11T11:00:00Z') };
		modal.onDidDismiss.mockResolvedValue({ data: newSlot });
		callable.mockRejectedValue(new Error('Slot unavailable'));

		await component.editDateTime();

		expect(createAlert).toHaveBeenCalledWith(expect.objectContaining({
			header: 'Error changing date/time', message: 'Slot unavailable',
		}));
		expect((currentRegistration.value as { dateTimeSlot: { id: string } }).dateTimeSlot.id).toBe('slot-1');
	});

	it('routes a successful check-in to confirmation with the preserved input method', async () => {
		checkIn.mockResolvedValue(4);
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		await component.checkIn();

		expect(checkIn).toHaveBeenCalledWith(currentRegistration.value, false, 'manual');
		expect(setCheckIn).toHaveBeenCalledWith(4, 'ABCDEFGH');
		expect(navigate).toHaveBeenCalledWith(['/admin/checkin/confirmation']);
	});

	it('sends duplicate-risk errors to the blocked scan view', async () => {
		const details = {
			disposition: 'duplicate-risk',
			registration: currentRegistration.value,
			attempt: { inputMethod: 'manual' },
		};
		checkIn.mockRejectedValue({ details });
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		await component.checkIn();

		expect(setBlockedScan).toHaveBeenCalledWith(details);
		expect(navigate).toHaveBeenCalledWith(['/admin/checkin/duplicate', 'customer-1']);
	});

	it('shows ordinary check-in errors, resets context, and returns to scanning', async () => {
		checkIn.mockRejectedValue(new Error('Network unavailable'));
		alert.onDidDismiss.mockResolvedValue({ role: 'dismiss' });
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		await component.checkIn();

		expect(createAlert).toHaveBeenCalledWith(expect.objectContaining({
			header: 'Error checking in',
			message: 'Network unavailable',
		}));
		expect(reset).toHaveBeenCalledOnce();
		expect(navigate).toHaveBeenCalledWith(['/admin/checkin/scan']);
	});
});
