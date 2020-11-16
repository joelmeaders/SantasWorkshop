import { ChangeDetectionStrategy, Component, OnDestroy, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';
import { BehaviorSubject, Subject } from 'rxjs';
import { distinctUntilChanged, map, publishReplay, refCount, takeUntil } from 'rxjs/operators';
import { QrModalComponent } from 'santashop-admin/src/app/shared/components/qr-modal/qr-modal.component';
import { CheckInService } from 'santashop-admin/src/app/shared/services/check-in.service';

@Component({
  selector: 'app-scanner',
  templateUrl: 'scanner.page.html',
  styleUrls: ['scanner.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScannerPage implements OnDestroy {
  private readonly $destroy = new Subject<void>();

  public readonly formatsEnabled: any = [11];

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
  );

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

  // private readonly autoStartCameraSubscription = this.$availableDevices.pipe(
  //   takeUntil(this.$destroy),
  //   filter(devices => !!devices?.length),
  //   // distinctUntilChanged((prev, curr) => prev.length !== curr.length),
  //   switchMap(devices => of(devices).pipe(delay(1000))),
  //   tap(console.log),
  //   tap(devices => this.autostartScanner(devices))
  // ).subscribe();

  constructor(
    private readonly checkInService: CheckInService,
    private readonly modalController: ModalController
  ) {
    // this.onCodeResult(`{"id":"TDC8SWZF","n":"Joel Meaders","c":[{"a":"3","n":"Benny Boo000","t":"b"}]}`);
  }

  public fakeCodeTest() {
    this.onCodeResult(`{"id":"TDC8SWZF","n":"Joel Meaders","c":[{"a":"3","n":"Benny Boo","t":"b"},{"a":"9","n":"Sasha Posh","t":"g"}]}`);
  }

  // public async autostartScanner(devices: MediaDeviceInfo[]): Promise<void> {

  //   const matcher = ({ label }) => /back|trás|rear|traseira|environment|ambiente/gi.test(label);

  //   // select the rear camera by default, otherwise take the last camera.
  //   const device = devices.find(matcher) || devices.pop();

  //   if (!device) {
  //     throw new Error('Impossible to autostart, no input devices available.');
  //   }

  //   console.log(device)

  //   this._$currentDevice.next(device);
  // }

  public async ngOnDestroy() {
    this.$destroy.next();
  }

  public onCamerasFound(devices: MediaDeviceInfo[]): void {
    this._$availableDevices.next(devices);
  }

  public async onCodeResult(resultString: string) {
    // this._$cameraEnabled.next(false);
    this.checkInService.setQrCode(resultString);
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
    const currentDevice = this._$currentDevice.getValue();

    if (!!currentDevice && device?.deviceId === currentDevice.deviceId)
      return;

    console.log('onDeviceChange', device);
    this._$currentDevice.next(device);
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

    this._$currentDevice.next(undefined);

    const modal = await this.modalController.create({
      component: QrModalComponent,
      cssClass: 'modal-lg',
      backdropDismiss: false
    });

    await modal.present();
  }

}
