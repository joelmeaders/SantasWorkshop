import { Component, ChangeDetectionStrategy } from '@angular/core';
import { AlertController, PopoverOptions } from '@ionic/angular';
import { RegistrationContextService } from '../../../shared/services/registration-context.service';
import { ScannerService } from './services/scanner.service';

@Component({
	selector: 'admin-checkin',
	templateUrl: './checkin.page.html',
	styleUrls: ['./checkin.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckinPage {
	public readonly $deviceId = this.scannerService.$deviceId;
	public readonly $availableDevices = this.scannerService.$availableDevices;
	public readonly formatsEnabled = this.scannerService.formatsEnabled;
	public readonly $deviceToUse = this.scannerService.$deviceToUse;

	protected readonly interfaceOptions: PopoverOptions = {
		alignment: 'center',
		side: 'top',
		showBackdrop: true,
		backdropDismiss: true,
	} as any;

	constructor(
		private readonly scannerService: ScannerService,
		private readonly registrationContext: RegistrationContextService,
		private readonly alertController: AlertController
	) {}

	public ionViewWillLeave(): void {
		this.scannerService.navigatedAway();
	}

	public ionViewDidLeave(): void {
		this.scannerService.navigatedAway();
	}

	public onCamerasFound(devices: MediaDeviceInfo[]): void {
		this.scannerService.onCamerasFound(devices);
	}

	public async onCodeResult(resultString: string): Promise<void> {
		try {
			await this.registrationContext.setCurrentRegistrationByCode(
				resultString
			);
		} catch (error: any) {
			error.code = 'find-reg';
			await this.handleError(error);
		}
	}

	public onDeviceSelectChange($event: any): void {
		// deviceId
		this.scannerService.onDeviceSelectChange($event);
	}

	public onDeviceChange(device: MediaDeviceInfo): void {
		this.scannerService.onDeviceChange(device);
	}

	public onHasPermission(value: boolean): void {
		this.scannerService.onHasPermission(value);
	}

	public async onScanError(error: any): Promise<void> {
		this.scannerService.onScanError(error);
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
