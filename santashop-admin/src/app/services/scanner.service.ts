import { Injectable, OnDestroy } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { IError } from '../../../../santashop-models/src/public-api';
import { BehaviorSubject, Subject } from 'rxjs';
import {
	takeUntil,
	publishReplay,
	refCount,
	distinctUntilChanged,
	map,
	take,
} from 'rxjs/operators';
import { LookupService } from './lookup.service';
import { RegistrationContextService } from './registration-context.service';

@Injectable({
	providedIn: 'root',
})
export class ScannerService implements OnDestroy {
	private readonly $destroy = new Subject<void>();

	public readonly formatsEnabled: any = [11];

	private readonly hasPermissions = new BehaviorSubject<boolean>(false);
	public readonly $hasPermissions = this.hasPermissions.pipe(
		takeUntil(this.$destroy),
		publishReplay(1),
		refCount()
	);

	private readonly availableDevices = new BehaviorSubject<
		MediaDeviceInfo[] | undefined
	>(undefined);
	public readonly $availableDevices = this.availableDevices.pipe(
		takeUntil(this.$destroy),
		publishReplay(1),
		refCount()
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
		publishReplay(1),
		refCount()
	);

	public readonly $deviceToUse = this.$currentDevice.pipe(
		takeUntil(this.$destroy),
		map((current) => current ?? undefined),
		publishReplay(1),
		refCount()
	);

	public readonly $deviceId = this.currentDevice.pipe(
		takeUntil(this.$destroy),
		map((current) => (current ? current.deviceId : '')),
		publishReplay(1),
		refCount()
	);

	private readonly cameraEnabled = new BehaviorSubject<boolean>(true);
	public readonly $cameraEnabled = this.cameraEnabled.pipe(
		takeUntil(this.$destroy),
		publishReplay(1),
		refCount()
	);

	constructor(
		private readonly lookupService: LookupService,
		private readonly registrationContext: RegistrationContextService,
		private readonly alertController: AlertController
	) {}

	public async ngOnDestroy(): Promise<void> {
		this.$destroy.next();
	}

	public navigatedAway(): void {
		this.onDeviceSelectChange({ detail: { value: '' } });
	}

	public setCameraEnabled(value: boolean): void {
		this.cameraEnabled.next(value);

		if (!value) {
			this.currentDevice.next(undefined);
			return;
		}

		if (this.previousDevice.getValue()) {
			this.currentDevice.next(this.previousDevice.getValue());
		}
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

	public async onCodeResult(resultString: string): Promise<void> {
		try {
			const registration = await this.lookupService
				.getRegistrationByQrCode$(resultString)
				.pipe(take(1))
				.toPromise();

			if (registration) {
				this.registrationContext.setCurrentRegistration(registration);
			} else {
				throw new Error(
					`Unable to find registration by qr code ${resultString}`
				);
			}
		} catch (error: any) {
			error.code = 'find-reg';
			await this.handleError(error as IError);
		}
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
