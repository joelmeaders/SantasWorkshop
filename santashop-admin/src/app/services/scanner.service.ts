import { Injectable, OnDestroy } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { IError } from '@models/*';
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

	private readonly _$hasPermissions = new BehaviorSubject<boolean>(false);
	public readonly $hasPermissions = this._$hasPermissions.pipe(
		takeUntil(this.$destroy),
		publishReplay(1),
		refCount()
	);

	private readonly _$availableDevices = new BehaviorSubject<
		MediaDeviceInfo[] | undefined
	>(undefined);
	public readonly $availableDevices = this._$availableDevices.pipe(
		takeUntil(this.$destroy),
		publishReplay(1),
		refCount()
	);

	private readonly _$previousDevice = new BehaviorSubject<
		MediaDeviceInfo | any
	>(undefined);

	private readonly _$currentDevice = new BehaviorSubject<
		MediaDeviceInfo | any
	>(undefined);
	public readonly $currentDevice = this._$currentDevice.pipe(
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

	public readonly $deviceId = this._$currentDevice.pipe(
		takeUntil(this.$destroy),
		map((current) => (!!current ? current.deviceId : '')),
		publishReplay(1),
		refCount()
	);

	private readonly _$cameraEnabled = new BehaviorSubject<boolean>(true);
	public readonly $cameraEnabled = this._$cameraEnabled.pipe(
		takeUntil(this.$destroy),
		publishReplay(1),
		refCount()
	);

	constructor(
		private readonly lookupService: LookupService,
		private readonly registrationContext: RegistrationContextService,
		private readonly alertController: AlertController
	) {}

	public async ngOnDestroy() {
		this.$destroy.next();
	}

	public navigatedAway() {
		this.onDeviceSelectChange({ detail: { value: '' } });
	}

	public setCameraEnabled(value: boolean) {
		this._$cameraEnabled.next(value);

		if (!value) {
			this._$currentDevice.next(undefined);
			return;
		}

		if (this._$previousDevice.getValue()) {
			this._$currentDevice.next(this._$previousDevice.getValue());
		}
	}

	public setCurrentDevice(device: MediaDeviceInfo | any) {
		if (!device && this._$currentDevice.getValue()) {
			this._$previousDevice.next(this._$currentDevice.getValue());
		}

		this._$currentDevice.next(device);
	}

	public onCamerasFound(devices: MediaDeviceInfo[]): void {
		this._$availableDevices.next(devices);
	}

	public async onCodeResult(resultString: string) {
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

	public onDeviceSelectChange($event: any) {
		// deviceId

		const deviceId = $event?.detail?.value;

		if (deviceId === undefined || null) {
			return;
		}

		const currentDevice = this._$currentDevice.getValue();

		if (currentDevice?.deviceId === deviceId) {
			return;
		}

		const devices = this._$availableDevices.getValue();
		const device = devices?.find((d) => d.deviceId === deviceId);

		this.setCurrentDevice(device);
	}

	onDeviceChange(device: MediaDeviceInfo) {
		const currentDevice = this._$currentDevice.getValue();

		if (!!currentDevice && device?.deviceId === currentDevice.deviceId)
			return;

		this.setCurrentDevice(device);
	}

	onHasPermission(value: boolean): void {
		this._$hasPermissions.next(value);
	}

	public async onScanError(error: any) {
		await this.handleError(error);
		this.onDeviceSelectChange({ detail: { value: '' } });
	}

	private async handleError(error: any) {
		const alert = await this.alertController.create({
			header: 'Error',
			subHeader: error.name,
			message: error.message,
			buttons: ['Ok'],
		});

		await alert.present();
	}
}
