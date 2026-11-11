import {
	readAdminPreference,
	saveAdminPreference,
} from '../../../../shared/preferences/admin-theme.service';
import { createAdminAlert } from '../../../../shared/preferences/admin-overlays';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { BehaviorSubject, Subject } from 'rxjs';
import {
	takeUntil,
	distinctUntilChanged,
	map,
	shareReplay,
} from 'rxjs/operators';

@Injectable()
export class ScannerService implements OnDestroy {
	private readonly alertController = inject(AlertController);

	private readonly $destroy = new Subject<void>();

	public readonly formatsEnabled: number[] = [11];

	private readonly hasPermissions = new BehaviorSubject<boolean>(false);
	public readonly $hasPermissions = this.hasPermissions.pipe(
		takeUntil(this.$destroy),
		shareReplay(1),
	);

	private readonly availableDevices = new BehaviorSubject<
		MediaDeviceInfo[] | undefined
	>(undefined);
	public readonly $availableDevices = this.availableDevices.pipe(
		takeUntil(this.$destroy),
		shareReplay(1),
	);

	private readonly cameraPreferenceKey = 'santashop-admin-scanner-camera';
	private preferredDeviceId = readAdminPreference(this.cameraPreferenceKey);

	private readonly currentDevice = new BehaviorSubject<
		MediaDeviceInfo | undefined
	>(undefined);
	public readonly $currentDevice = this.currentDevice.pipe(
		takeUntil(this.$destroy),
		distinctUntilChanged((prev, curr) => prev?.deviceId === curr?.deviceId),
		shareReplay(1),
	);

	public readonly $deviceToUse = this.$currentDevice.pipe(
		takeUntil(this.$destroy),
		map((current) => current ?? undefined),
		shareReplay(1),
	);

	public readonly $deviceId = this.currentDevice.pipe(
		takeUntil(this.$destroy),
		map((current) => (current ? current.deviceId : '')),
		shareReplay(1),
	);

	public async ngOnDestroy(): Promise<void> {
		this.$destroy.next();
	}

	public setCurrentDevice(device: MediaDeviceInfo | undefined): void {
		this.currentDevice.next(device);
	}

	public onCamerasFound(devices: MediaDeviceInfo[]): void {
		this.availableDevices.next(devices);
	}

	public selectInitialDevice(): void {
		// Select before starting a stream, so a broken default camera cannot override the preference.
		const preferred = this.availableDevices
			.getValue()
			?.find((device) => device.deviceId === this.preferredDeviceId);
		const devices = this.availableDevices.getValue() ?? [];
		const fallback =
			devices.find((device) =>
				/back|trás|rear|traseira|environment|ambiente/i.test(device.label),
			) ?? devices.at(-1);
		this.setCurrentDevice(preferred ?? fallback);
	}

	public onDeviceSelectChange($event: { detail?: { value?: string } }): void {
		// deviceId
		const deviceId = $event?.detail?.value;

		if (deviceId == null) {
			return;
		}

		const currentDevice = this.currentDevice.getValue();

		if (currentDevice?.deviceId === deviceId) {
			return;
		}

		const devices = this.availableDevices.getValue();
		const device = devices?.find((d) => d.deviceId === deviceId);

		if (!device && deviceId !== '') return;
		if (device) {
			this.preferredDeviceId = device.deviceId;
			// Store only the opaque ID locally, never camera labels or scanned data.
			saveAdminPreference(this.cameraPreferenceKey, device.deviceId);
		}
		this.setCurrentDevice(device);
	}

	public onDeviceChange(device: MediaDeviceInfo): void {
		const currentDevice = this.currentDevice.getValue();

		if (!!currentDevice && device?.deviceId === currentDevice.deviceId)
			return;

		this.setCurrentDevice(device);
	}

	public onHasPermission(value: boolean): void {
		this.hasPermissions.next(value);
	}

	public async onScanError(error: {
		name?: string;
		message?: string;
	}): Promise<void> {
		await this.handleError(error);
		this.onDeviceSelectChange({ detail: { value: '' } });
	}

	private async handleError(error: {
		name?: string;
		message?: string;
	}): Promise<void> {
		const alert = await createAdminAlert(this.alertController, () => ({
			header: 'Error',
			subHeader: error.name,
			message: error.message,
			buttons: ['Ok'],
		}));

		await alert.present();
	}
}
