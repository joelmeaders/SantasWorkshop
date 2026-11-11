import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScannerService } from './scanner.service';

describe('ScannerService', () => {
	const present = vi.fn().mockResolvedValue(undefined);
	const createAlert = vi.fn().mockResolvedValue({ present });

	const camera = (deviceId: string): MediaDeviceInfo => ({
		deviceId,
		groupId: 'camera-group',
		kind: 'videoinput',
		label: `Camera ${deviceId}`,
		toJSON: () => ({}),
	});

	const preferenceKey = 'santashop-admin-scanner-camera';
	afterEach(() => {
		localStorage.removeItem(preferenceKey);
		vi.restoreAllMocks();
	});
	beforeEach(() => {
		localStorage.removeItem(preferenceKey);
		present.mockClear();
		createAlert.mockClear();
		TestBed.configureTestingModule({
			providers: [
				ScannerService,
				{
					provide: AlertController,
					useValue: { create: createAlert },
				},
			],
		});
	});

	it('publishes camera availability, permission, and the selected device', async () => {
		const service = TestBed.inject(ScannerService);
		const cameras = [camera('front'), camera('rear')];

		service.onCamerasFound(cameras);
		service.onHasPermission(true);
		service.onDeviceSelectChange({ detail: { value: 'rear' } });

		await expect(
			firstValueFrom(service.$availableDevices),
		).resolves.toEqual(cameras);
		await expect(firstValueFrom(service.$hasPermissions)).resolves.toBe(
			true,
		);
		await expect(firstValueFrom(service.$deviceId)).resolves.toBe('rear');
		await expect(firstValueFrom(service.$deviceToUse)).resolves.toBe(
			cameras[1],
		);
	});

	it('ignores an absent selection and preserves the current camera', async () => {
		const service = TestBed.inject(ScannerService);
		service.onCamerasFound([camera('front')]);
		service.onDeviceSelectChange({ detail: { value: 'front' } });

		service.onDeviceSelectChange({ detail: {} });

		await expect(firstValueFrom(service.$deviceId)).resolves.toBe('front');
	});

	it('accepts hardware-originated device changes', async () => {
		const service = TestBed.inject(ScannerService);
		const rearCamera = camera('rear');

		service.onDeviceChange(rearCamera);

		await expect(firstValueFrom(service.$currentDevice)).resolves.toBe(
			rearCamera,
		);
	});

	it('restores a saved choice after automatic startup without saving the default', async () => {
		localStorage.setItem(preferenceKey, 'rear');
		const service = TestBed.inject(ScannerService);
		service.onCamerasFound([camera('front'), camera('rear')]);
		service.onDeviceChange(camera('front'));
		service.selectInitialDevice();
		await expect(firstValueFrom(service.$deviceId)).resolves.toBe('rear');
		expect(localStorage.getItem(preferenceKey)).toBe('rear');
		service.onDeviceSelectChange({ detail: { value: 'front' } });
		expect(localStorage.getItem(preferenceKey)).toBe('front');
		service.setCurrentDevice(undefined);
		service.onDeviceChange(camera('rear'));
		service.selectInitialDevice();
		await expect(firstValueFrom(service.$deviceId)).resolves.toBe('front');
	});

	it('keeps the available default when the saved camera is disconnected', async () => {
		localStorage.setItem(preferenceKey, 'missing');
		const service = TestBed.inject(ScannerService);
		service.onCamerasFound([camera('front')]);
		service.onDeviceChange(camera('front'));
		service.selectInitialDevice();
		await expect(firstValueFrom(service.$deviceId)).resolves.toBe('front');
		service.onDeviceSelectChange({ detail: { value: 'unknown' } });
		await expect(firstValueFrom(service.$deviceId)).resolves.toBe('front');
		expect(localStorage.getItem(preferenceKey)).toBe('missing');
	});

	it('works without persistent storage and retains the choice for this session', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		const service = TestBed.inject(ScannerService);
		service.onCamerasFound([camera('front'), camera('rear')]);
		service.onDeviceSelectChange({ detail: { value: 'rear' } });
		service.setCurrentDevice(undefined);
		service.onDeviceChange(camera('front'));
		service.selectInitialDevice();
		await expect(firstValueFrom(service.$deviceId)).resolves.toBe('rear');
	});

	it('handles an empty device list without forgetting the preferred camera', async () => {
		localStorage.setItem(preferenceKey, 'rear');
		const service = TestBed.inject(ScannerService);
		service.onCamerasFound([]);
		service.selectInitialDevice();
		await expect(firstValueFrom(service.$deviceId)).resolves.toBe('');
		expect(localStorage.getItem(preferenceKey)).toBe('rear');
	});

	it('shows scan errors and clears the selected device', async () => {
		const service = TestBed.inject(ScannerService);
		service.onCamerasFound([camera('front')]);
		service.onDeviceSelectChange({ detail: { value: 'front' } });

		await service.onScanError({
			name: 'NotReadableError',
			message: 'Camera is busy',
		});

		expect(createAlert).toHaveBeenCalledWith({
			header: 'Error',
			subHeader: 'NotReadableError',
			message: 'Camera is busy',
			buttons: ['Ok'],
		});
		expect(present).toHaveBeenCalled();
		await expect(firstValueFrom(service.$deviceId)).resolves.toBe('');
	});
});
