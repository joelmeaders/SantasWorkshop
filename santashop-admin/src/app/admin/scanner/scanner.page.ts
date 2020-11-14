import { AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, ViewChild } from '@angular/core';
// import { CheckInService } from '@app/core/services/check-in.service';
// import { QrModalComponent } from '@app/shared/components/qr-modal/qr-modal.component';
import { ModalController } from '@ionic/angular';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';
import { BehaviorSubject, Subject } from 'rxjs';
import { distinctUntilChanged, map, publishReplay, refCount, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-scanner',
  templateUrl: './scanner.page.html',
  styleUrls: ['./scanner.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScannerPage implements AfterViewInit, OnDestroy {
  private readonly $destroy = new Subject<void>();

  // public readonly formatsEnabled: BarcodeFormat[] = [BarcodeFormat.QR_CODE];
  public readonly formatsEnabled: any = 11;

  private readonly _$hasPermissions = new BehaviorSubject<boolean>(false);
  public readonly $hasPermissions = this._$hasPermissions.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  private readonly _$availableDevices = new BehaviorSubject<MediaDeviceInfo[]>(undefined);
  public readonly $availableDevices = this._$availableDevices.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  // private readonly _$selectedDevice = new BehaviorSubject<string>('');
  // public readonly $selectedDevice = this._$selectedDevice.pipe(
  //   takeUntil(this.$destroy),
  //   publishReplay(1),
  //   refCount()
  // );

  private readonly _$currentDevice = new BehaviorSubject<MediaDeviceInfo>(undefined);
  public readonly $currentDevice = this._$currentDevice.pipe(
    takeUntil(this.$destroy),
    distinctUntilChanged((prev, curr) => prev?.deviceId === curr?.deviceId),
    publishReplay(1),
    refCount()
  );

  public readonly $deviceToUse = this.$currentDevice.pipe(
    takeUntil(this.$destroy),
    map(current => current ?? undefined),
    publishReplay(1),
    refCount()
  );

  public readonly $deviceId = this._$currentDevice.pipe(
    takeUntil(this.$destroy),
    map(current => !!current ? current.deviceId : ''),
    publishReplay(1),
    refCount()
  )

  tryHarder: boolean;

  private readonly _$cameraEnabled = new BehaviorSubject<boolean>(true);
  public readonly $cameraEnabled = this._$cameraEnabled.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  torchEnabled = false;
  torchAvailable$ = new BehaviorSubject<boolean>(undefined);

  @ViewChild('scanner') scanner: ZXingScannerComponent;

  constructor(
    // private readonly checkInService: CheckInService,
    private readonly modalController: ModalController
  ) { }

  public async ngAfterViewInit() {
    // var permission = await this.scanner.askForPermission();
    // if (permission) {
    //   this.scanner.updateVideoInputDevices();
    // }
  }

  public async ngOnDestroy() {
    this.$destroy.next();
  }

  public onCamerasFound(devices: MediaDeviceInfo[]): void {
    this._$availableDevices.next(devices);
  }

  public async onCodeResult(resultString: string) {
    this._$cameraEnabled.next(false);
    // this.checkInService.setQrCode(resultString);
    await this.openModal();
  }

  public onDeviceSelectChange(deviceId: string) {

    if (!deviceId) {
      return;
    }

    const currentDevice = this._$currentDevice.getValue();

    if (currentDevice?.deviceId === deviceId) {
      return;
    }

    console.log('setting device', deviceId)

    const devices = this._$availableDevices.getValue();
    const device = devices.find(d => d.deviceId === deviceId);

    console.log(device);

    this._$currentDevice.next(device);
    // this._$cameraEnabled.next(true);
  }

  onDeviceChange(device: MediaDeviceInfo) {
    this._$currentDevice.next(device);
    // this._$cameraEnabled.next(true);
    // console.log('onDeviceChange');
    // const selectedStr = device?.deviceId || '';
    // if (this.selectedDevice === selectedStr) { return; }
    // this.selectedDevice = selectedStr;
    // this.deviceCurrent = device || undefined;
  }

  onHasPermission(value: boolean) {
    this._$hasPermissions.next(value);
  }

  onTorchCompatible(isCompatible: boolean): void {
    this.torchAvailable$.next(isCompatible || false);
  }

  toggleTorch(): void {
    this.torchEnabled = !this.torchEnabled;
  }

  private async openModal() {
  //   const modal = await this.modalController.create({
  //     component: QrModalComponent,
  //     cssClass: 'modal-md',
  //   });

  //   await modal.present();
  }
}
