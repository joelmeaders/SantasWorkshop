import { Injectable, OnDestroy } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { BehaviorSubject, Subject } from 'rxjs';
import {
	takeUntil,
	distinctUntilChanged,
	map,
	shareReplay,
} from 'rxjs/operators';

@Injectable()
export class ScannerService implements OnDestroy {
	private readonly $destroy = new Subject<void>();

	public readonly formatsEnabled: any = [11];

	private readonly hasPermissions = new BehaviorSubject<boolean>(false);
	public readonly $hasPermissions = this.hasPermissions.pipe(
		takeUntil(this.$destroy),
		shareReplay(1)
	);

	private readonly availableDevices = new BehaviorSubject<
		MediaDeviceInfo[] | undefined
	>(undefined);
	public readonly $availableDevices = this.availableDevices.pipe(
		takeUntil(this.$destroy),
		shareReplay(1)
	);

	private readonly previousDevice = new BehaviorSubject<
		MediaDeviceInfo | any
	>(undefined);

	private readonly currentDevice = new BehaviorSubject<MediaDeviceInfo | any>(
		undefined
	);
	public readonly $currentDevice = this.currentDevice.pipe(
		takeUntil(this.$destroy),
		distinctUntilChanged((prev, curr) => prev?.deviceId === curr?.deviceId),
		shareReplay(1)
	);

	public readonly $deviceToUse = this.$currentDevice.pipe(
		takeUntil(this.$destroy),
		map((current) => current ?? undefined),
		shareReplay(1)
	);

	public readonly $deviceId = this.currentDevice.pipe(
		takeUntil(this.$destroy),
		map((current) => (current ? current.deviceId : '')),
		shareReplay(1)
	);

	constructor(private readonly alertController: AlertController) {}

	public async ngOnDestroy(): Promise<void> {
		this.$destroy.next();
	}

	public setCurrentDevice(device: MediaDeviceInfo | any): void {
		if (!device && this.currentDevice.getValue()) {
			this.previousDevice.next(this.currentDevice.getValue());
		}

		this.currentDevice.next(device);
	}

	public onCamerasFound(devices: MediaDeviceInfo[]): void {
		this.availableDevices.next(devices);
	}

	public onDeviceSelectChange($event: any): void {
		// deviceId
		const deviceId = $event?.detail?.value;

		if (deviceId === undefined || null) {
			return;
		}

		const currentDevice = this.currentDevice.getValue();

		if (currentDevice?.deviceId === deviceId) {
			return;
		}

		const devices = this.availableDevices.getValue();
		const device = devices?.find((d) => d.deviceId === deviceId);

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

	public async onScanError(error: any): Promise<void> {
		await this.handleError(error);
		this.onDeviceSelectChange({ detail: { value: '' } });
	}

	private async handleError(error: any): Promise<void> {
		const alert = await this.alertController.create({
			header: 'Error',
			subHeader: error.name,
			message: error.message,
			buttons: ['Ok'],
		});

		await alert.present();
	}
}
