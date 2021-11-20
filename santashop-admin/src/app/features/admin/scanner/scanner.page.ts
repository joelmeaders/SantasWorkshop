import { ChangeDetectionStrategy, Component, OnDestroy, ViewChild } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';
import { BehaviorSubject, Subject } from 'rxjs';
import { distinctUntilChanged, map, publishReplay, refCount, takeUntil } from 'rxjs/operators';
import { QrModalComponent } from 'santashop-admin/src/app/components/qr-modal/qr-modal.component';
import { CheckInService } from 'santashop-admin/src/app/services/check-in.service';

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

  private readonly _$availableDevices = new BehaviorSubject<MediaDeviceInfo[] | undefined>(undefined);
  public readonly $availableDevices = this._$availableDevices.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  private readonly _$currentDevice = new BehaviorSubject<MediaDeviceInfo | any>(undefined);
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

  private readonly _$cameraEnabled = new BehaviorSubject<boolean>(true);
  public readonly $cameraEnabled = this._$cameraEnabled.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  @ViewChild('scanner') scanner?: ZXingScannerComponent = undefined;

  constructor(
    private readonly checkInService: CheckInService,
    private readonly modalController: ModalController,
    private readonly alertController: AlertController
  ) { }

  public async ngOnDestroy() {
    this.$destroy.next();
  }

  public onCamerasFound(devices: MediaDeviceInfo[]): void {
    this._$availableDevices.next(devices);
  }

  public async onCodeResult(resultString: string) {
    this.onDeviceSelectChange('');
    this.checkInService.setRegistrationCode(resultString);
    await this.openModal();
  }

  public onDeviceSelectChange($event: any) { // deviceId

    const deviceId = $event?.detail?.value;

    if (deviceId === undefined || null) {
      return;
    }

    const currentDevice = this._$currentDevice.getValue();

    if (currentDevice?.deviceId === deviceId) {
      return;
    }

    const devices = this._$availableDevices.getValue();
    const device = devices?.find(d => d.deviceId === deviceId);

    this._$currentDevice.next(device);
  }

  onDeviceChange(device: MediaDeviceInfo) {
    const currentDevice = this._$currentDevice.getValue();

    if (!!currentDevice && device?.deviceId === currentDevice.deviceId)
      return;

    this._$currentDevice.next(device);
  }

  onHasPermission(value: boolean): void {
    this._$hasPermissions.next(value);
  }

  public async onScanError(error: any) {
    await this.handleError(error);
    this.onDeviceSelectChange('');
  }

  private async handleError(error: any) {

    const alert = await this.alertController.create({
      header: 'Error',
      subHeader: error.name,
      message: error.message,
      buttons: ['Ok']
    });

    await alert.present();

  }

  private async openModal() {

    this._$currentDevice.next(undefined);

    const modal = await this.modalController.create({
      component: QrModalComponent,
      cssClass: 'modal-lg',
      backdropDismiss: false
    });

    await modal.present();
    await modal.onDidDismiss();
  }

}
