import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { BarcodeFormat } from '@zxing/library';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-scanner',
  templateUrl: './scanner.page.html',
  styleUrls: ['./scanner.page.scss'],
  // changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScannerPage implements OnInit {
  availableDevices: MediaDeviceInfo[];
  deviceCurrent: MediaDeviceInfo;
  deviceSelected: string;

  formatsEnabled: BarcodeFormat[] = [BarcodeFormat.QR_CODE];

  hasDevices: boolean;
  hasPermission: boolean;

  qrResultString: string;

  torchEnabled = false;
  torchAvailable$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.deviceCurrent = null;
  }

  ngOnInit() {}

  clearResult(): void {
    this.qrResultString = null;
  }

  onCamerasFound(devices: MediaDeviceInfo[]): void {
    this.availableDevices = devices;

    console.log('CamerasFound')

    if (this.availableDevices && this.availableDevices.length > 0) {
      this.hasDevices = true;
      this.deviceCurrent = this.availableDevices[0];
    }
  }

  onCodeResult(resultString: string) {
    this.qrResultString = resultString;
  }

  onDeviceSelectChange(selected: string) {
    console.log('SelectChange', selected)
    this.deviceSelected = selected || '';
    const device = this.availableDevices.find((x) => x.deviceId === selected);
    this.deviceCurrent = device;
  }

  onDeviceChange(device: MediaDeviceInfo) {
    console.log('DeviceChange', device)
    this.deviceSelected = device?.deviceId;
    this.deviceCurrent = device;
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
