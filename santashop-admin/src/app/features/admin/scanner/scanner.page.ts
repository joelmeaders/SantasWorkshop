import { Component } from '@angular/core';
import { ScannerService } from '../../../services/scanner.service';

@Component({
  selector: 'app-scanner',
  templateUrl: 'scanner.page.html',
  styleUrls: ['scanner.page.scss'],
})
export class ScannerPage {
  public readonly formatsEnabled = this.scannerService.formatsEnabled;
  public readonly $hasPermissions = this.scannerService.$hasPermissions;
  public readonly $availableDevices = this.scannerService.$availableDevices;
  public readonly $currentDevice = this.scannerService.$currentDevice;
  public readonly $deviceToUse = this.scannerService.$deviceToUse;
  public readonly $deviceId = this.scannerService.$deviceId;
  public readonly $cameraEnabled = this.scannerService.$cameraEnabled;

  constructor(private readonly scannerService: ScannerService) {}

  public ionViewWillLeave() {
    this.scannerService.navigatedAway();
  }

  public ionViewDidLeave() {
    this.scannerService.navigatedAway();
  }

  public onCamerasFound(devices: MediaDeviceInfo[]): void {
    this.scannerService.onCamerasFound(devices);
  }

  public async onCodeResult(resultString: string) {
    this.scannerService.onCodeResult(resultString);
  }

  public onDeviceSelectChange($event: any) {
    // deviceId
    this.scannerService.onDeviceSelectChange($event);
  }

  public onDeviceChange(device: MediaDeviceInfo) {
    this.scannerService.onDeviceChange(device);
  }

  public onHasPermission(value: boolean): void {
    this.scannerService.onHasPermission(value);
  }

  public async onScanError(error: any) {
    this.scannerService.onScanError(error);
  }
}
