import { TestBed } from '@angular/core/testing';
import { LoadingController } from '@ionic/angular';
import { FunctionsWrapper } from '@santashop/core';
import type { Registration } from '@santashop/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckInService } from './check-in.service';

describe('CheckInService', () => {
	const checkIn = vi.fn();
	const checkInWithEdit = vi.fn();
	const onSiteRegistration = vi.fn();
	const callableWrapper = vi.fn((name: string) => {
		const callables: Record<string, ReturnType<typeof vi.fn>> = {
			checkIn,
			checkInWithEdit,
			onSiteRegistration,
		};
		return callables[name];
	});
	const present = vi.fn().mockResolvedValue(undefined);
	const loadingCreate = vi.fn().mockResolvedValue({ present });
	const getTop = vi.fn().mockResolvedValue({});
	const dismiss = vi.fn().mockResolvedValue(true);

	const registration = {
		uid: 'registration-1',
		qrcode: 'QR-123',
		zipCode: '80202',
		children: [{ id: 1, firstName: 'Kid' }],
		firstName: 'Parent',
		lastName: 'Customer',
	} as unknown as Registration;

	beforeEach(() => {
		checkIn.mockReset().mockResolvedValue({ data: 2 });
		checkInWithEdit.mockReset().mockResolvedValue({ data: 3 });
		onSiteRegistration.mockReset().mockResolvedValue({ data: 4 });
		callableWrapper.mockClear();
		present.mockClear();
		loadingCreate.mockClear();
		getTop.mockReset().mockResolvedValue({});
		dismiss.mockClear();
		TestBed.configureTestingModule({
			providers: [
				{ provide: FunctionsWrapper, useValue: { callableWrapper } },
				{
					provide: LoadingController,
					useValue: { create: loadingCreate, getTop, dismiss },
				},
			],
		});
	});

	it('rejects a registration without a uid before showing a loader', async () => {
		const service = TestBed.inject(CheckInService);

		await expect(service.checkIn({} as Registration)).rejects.toThrow(
			'Invalid registration',
		);
		expect(loadingCreate).not.toHaveBeenCalled();
	});

	it('checks in with the minimal server-owned registration payload', async () => {
		const service = TestBed.inject(CheckInService);

		await expect(service.checkIn(registration)).resolves.toBe(2);
		expect(callableWrapper).toHaveBeenCalledWith('checkIn');
		expect(checkIn).toHaveBeenCalledWith({
			uid: 'registration-1',
			qrcode: 'QR-123',
			zipCode: '80202',
			children: registration.children,
			hasCheckedIn: true,
		});
		expect(dismiss).toHaveBeenCalled();
	});

	it('uses the edited check-in callable when requested', async () => {
		const service = TestBed.inject(CheckInService);

		await expect(service.checkIn(registration, true)).resolves.toBe(3);
		expect(callableWrapper).toHaveBeenCalledWith('checkInWithEdit');
		expect(checkInWithEdit).toHaveBeenCalled();
		expect(checkIn).not.toHaveBeenCalled();
	});

	it('dismisses the loader when a callable fails', async () => {
		const service = TestBed.inject(CheckInService);
		checkIn.mockRejectedValue(new Error('check-in failed'));

		await expect(service.checkIn(registration)).rejects.toThrow(
			'check-in failed',
		);
		expect(dismiss).toHaveBeenCalled();
	});

	it('submits the complete on-site registration and returns its coupon count', async () => {
		const service = TestBed.inject(CheckInService);

		await expect(service.onSiteRegistration(registration)).resolves.toBe(4);
		expect(callableWrapper).toHaveBeenCalledWith('onSiteRegistration');
		expect(onSiteRegistration).toHaveBeenCalledWith(registration);
		expect(dismiss).toHaveBeenCalled();
	});
});
