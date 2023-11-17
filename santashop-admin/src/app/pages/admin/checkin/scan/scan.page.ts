import { Component, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, PopoverOptions } from '@ionic/angular';
import {
	BehaviorSubject,
	distinctUntilChanged,
	Observable,
	of,
	Subject,
	Subscription,
	switchMap,
	tap,
	throttleTime,
} from 'rxjs';
import { LookupService } from '../../../../shared/services/lookup.service';
import { ScannerService } from './scanner.service';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';
import { filterNil } from '@santashop/core';

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
	public readonly formatsEnabled = this.scannerService.formatsEnabled;
	public readonly deviceToUse$ = this.scannerService.$deviceToUse;
	public readonly hasPermissions$ = this.scannerService.$hasPermissions;

	protected readonly scanResult = new Subject<string | undefined>();
	private readonly scanResultFilter$ = this.scanResult.asObservable().pipe(
		distinctUntilChanged(),
		throttleTime(3000),
		switchMap((code) => this.badCodeFilter(code)),
		filterNil(),
	);

	private readonly setRegistration$ = (): Observable<any> =>
		this.scanResultFilter$.pipe(
			switchMap((code) =>
				this.lookupService.getRegistrationByQrCode$(code),
			),
			switchMap((registration) => {
				if (registration) {
					this.checkinContext.setRegistration(registration);
					return this.router.navigate(['/admin/checkin/review']);
				} else {
					return this.cannotFindRegistrationAlert();
				}
			}),
		);

	public readonly scanError = new Subject<Error>();
	private readonly scanError$ = this.scanError.asObservable().pipe(
		throttleTime(5000),
		switchMap((error) => this.scannerService.onScanError(error)),
	);

	private readonly invalidCode = new Subject<void>();
	private readonly notifyInvalidCode$ = this.invalidCode.asObservable().pipe(
		tap(() => this.disableScanner()),
		switchMap(() => this.invalidCodeAlert()),
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
	private invalidCodeSubscription?: Subscription;

	constructor(
		private readonly scannerService: ScannerService,
		private readonly lookupService: LookupService,
		private readonly checkinContext: CheckInContextService,
		private readonly alertController: AlertController,
		private readonly router: Router,
	) {	}

	public ionViewWillEnter(): void {
		this.scanErrorSubscription = this.scanError$.subscribe();
		this.routeToReviewPageSubscription =
			this.setRegistration$().subscribe();
		this.invalidCodeSubscription = this.notifyInvalidCode$.subscribe();

		this.cameraEnabled$.next(true);
	}

	public ionViewWillLeave(): void {
		this.scanErrorSubscription?.unsubscribe();
		this.scanErrorSubscription = undefined;
		this.routeToReviewPageSubscription?.unsubscribe();
		this.routeToReviewPageSubscription = undefined;
		this.invalidCodeSubscription?.unsubscribe();
		this.invalidCodeSubscription = undefined;
		this.disableScanner();
	}

	private disableScanner(): void {
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

	public badCodeFilter(code?: string): Observable<string | undefined> {
		if (code?.length) code = code.toUpperCase();
		if (code !== 'XE7UBKJC') return of(code);
		this.invalidCode.next();
		return of(undefined);
	}

	private async invalidCodeAlert(): Promise<any> {
		const alertOkHandler = (value: { [key: string]: string }): void => {
			if ((value[0]?.length ?? 0) >= 7) this.scanResult.next(value[0]);
		};

		const alert = await this.alertController.create({
			header: 'Invalid code scanned',
			message: 'Manually type the code located below the QR image',
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel',
					cssClass: 'cancel-button',
					handler: async () =>
						(await this.alertController.getTop())?.dismiss(),
				},
				{
					text: 'OK',
					role: 'ok',
					handler: alertOkHandler,
				},
			],
			inputs: [
				{
					type: 'text',
					placeholder: 'Code (7-8 characters)',
					attributes: {
						minlength: 7,
						maxlength: 8,
					},
				},
			],
			backdropDismiss: true,
		});
		await alert.present();
		return alert.onDidDismiss();
	}

	private async cannotFindRegistrationAlert(): Promise<void> {
		const alert = await this.alertController.create({
			header: 'Oh No!',
			message: 'That registration could not be found',
			buttons: [
				{ text: 'Ok' },
				{
					text: 'Try Search',
					role: 'search',
					handler: () => this.router.navigate(['admin/search']),
				},
			],
		});

		await alert.present();
	}
}
