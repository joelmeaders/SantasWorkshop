import { Component, ViewChild } from '@angular/core';
import { CheckInService } from '@app/core/services/check-in.service';
import { BarcodeFormat } from '@zxing/library';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-scanner',
  templateUrl: './scanner.page.html',
  styleUrls: ['./scanner.page.scss'],
  // changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScannerPage {
  availableDevices: MediaDeviceInfo[];
  deviceCurrent: MediaDeviceInfo;
  deviceSelected: string;

  formatsEnabled: BarcodeFormat[] = [BarcodeFormat.QR_CODE];

  hasDevices: boolean;
  hasPermission: boolean;
  tryHarder: boolean;

  cameraEnabled = false;

  torchEnabled = false;
  torchAvailable$ = new BehaviorSubject<boolean>(false);

  @ViewChild('scanner') scanner: ZXingScannerComponent;

  constructor(
    private readonly checkInService: CheckInService
  ) {
    this.deviceCurrent = null;
  }

//  async delayAndTryHarder() {
//      await this.delay(1000);
//      this.toggleTryHarder();
//   }

//   delay(ms: number) {
//     return new Promise( resolve => setTimeout(resolve, ms) );
//   }

//   toggleTryHarder(): void {
//     this.tryHarder = !this.tryHarder;
//  }

  onCamerasFound(devices: MediaDeviceInfo[]): void {
    this.availableDevices = devices;
    this.hasDevices = Boolean(devices && devices.length);
  }

  onCodeResult(resultString: string) {
    console.log(resultString)
    this.cameraEnabled = false;
    this.checkInService.setQrCode(resultString);
  }

  onDeviceSelectChange(selected: any) {
    const selectedStr = selected || '';
    if (this.deviceSelected === selectedStr) { return; }
    this.deviceSelected = selectedStr;
    const device = this.availableDevices.find(x => x.deviceId === selected);
    this.deviceCurrent = device || undefined;
    this.cameraEnabled = true;
  }

  onDeviceChange(device: MediaDeviceInfo) {
    const selectedStr = device?.deviceId || '';
    if (this.deviceSelected === selectedStr) { return; }
    this.deviceSelected = selectedStr;
    this.deviceCurrent = device || undefined;
    this.cameraEnabled = true;
  }

  onHasPermission(has: boolean) {
    this.hasPermission = has;
  }

  onTorchCompatible(isCompatible: boolean): void {
    this.torchAvailable$.next(isCompatible || false);
  }

  toggleTorch(): void {
    this.torchEnabled = !this.torchEnabled;
  }
}
