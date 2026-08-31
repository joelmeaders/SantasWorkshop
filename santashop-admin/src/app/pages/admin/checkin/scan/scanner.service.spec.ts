import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

	beforeEach(() => {
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

		await expect(firstValueFrom(service.$availableDevices)).resolves.toEqual(
			cameras,
		);
		await expect(firstValueFrom(service.$hasPermissions)).resolves.toBe(true);
		await expect(firstValueFrom(service.$deviceId)).resolves.toBe('rear');
		await expect(firstValueFrom(service.$deviceToUse)).resolves.toBe(cameras[1]);
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
