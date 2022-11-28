import { Component, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, PopoverOptions } from '@ionic/angular';
import {
	BehaviorSubject,
	catchError,
	filter,
	from,
	Observable,
	Subject,
	Subscription,
	switchMap,
	tap,
	throttleTime,
} from 'rxjs';
import { Registration } from '@models/*';
import { LookupService } from '../../../../shared/services/lookup.service';
import { ScannerService } from './scanner.service';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';

@Component({
	selector: 'admin-scan',
	templateUrl: './scan.page.html',
	styleUrls: ['./scan.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanPage {
	public readonly cameraEnabled$ = new BehaviorSubject<boolean>(true);
	public readonly deviceId$ = this.scannerService.$deviceId;
	public readonly availableDevices$ = this.scannerService.$availableDevices;
	public readonly formatsEnabled$ = this.scannerService.formatsEnabled;
	public readonly deviceToUse$ = this.scannerService.$deviceToUse;
	public readonly hasPermissions$ = this.scannerService.$hasPermissions;

	private readonly scanResult = new Subject<string>();
	private readonly scanResult$ = (): Observable<Registration | undefined> =>
		this.scanResult.asObservable().pipe(
			filter((value) => !!value),
			throttleTime(5000),
			switchMap((code) =>
				this.lookupService.getRegistrationByQrCode$(code!)
			),
			filter((registration) => !!registration),
			tap((registration) =>
				this.checkinContext.setRegistration(registration)
			),
			catchError((error) => from(this.handleError(error)))
		);

	public readonly scanError = new Subject<Error>();
	private readonly scanError$ = this.scanError.asObservable().pipe(
		throttleTime(5000),
		switchMap((error) => this.scannerService.onScanError(error))
	);

	private readonly routeToReviewPage$ = (): Observable<boolean> =>
		this.scanResult$().pipe(
			switchMap(() =>
				from(this.router.navigate(['admin/checkin/review']))
			)
		);

	@ViewChild('scanner', { static: true })
	private readonly scanner?: ZXingScannerComponent;

	protected readonly interfaceOptions: PopoverOptions = {
		alignment: 'center',
		side: 'top',
		showBackdrop: true,
		backdropDismiss: true,
	} as any;

	private routeToReviewPageSubscription?: Subscription;
	private scanErrorSubscription?: Subscription;

	constructor(
		private readonly scannerService: ScannerService,
		private readonly lookupService: LookupService,
		private readonly checkinContext: CheckInContextService,
		private readonly alertController: AlertController,
		private readonly router: Router
	) {}

	public ionViewWillEnter(): void {
		this.cameraEnabled$.next(true);
		console.log('init scanner');
		this.scanErrorSubscription = this.scanError$.subscribe();
		this.routeToReviewPageSubscription =
			this.routeToReviewPage$().subscribe();
	}

	public ionViewWillLeave(): void {
		this.scanErrorSubscription?.unsubscribe();
		this.scanErrorSubscription = undefined;
		this.routeToReviewPageSubscription?.unsubscribe();
		this.routeToReviewPageSubscription = undefined;

		if (this.scanner) {
			this.scanner.scanStop();
			this.scanner.enable = false;
			this.scanner.device = undefined;
		}
		this.cameraEnabled$.next(false);
	}

	public onCamerasFound(devices: MediaDeviceInfo[]): void {
		this.scannerService.onCamerasFound(devices);
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

	public onScanResult(code: string): void {
		this.scanResult.next(code);
	}

	private async handleError(error: any): Promise<undefined> {
		const alert = await this.alertController.create({
			header: 'Error',
			message: error.message,
			buttons: ['Ok'],
		});

		await alert.present();
		return undefined;
	}
}
