import { Component, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, PopoverOptions } from '@ionic/angular';
import {
	BehaviorSubject,
	catchError,
	filter,
	firstValueFrom,
	from,
	Observable,
	Subject,
	Subscription,
	switchMap,
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

	private readonly scanResultFilter$ = this.scanResult.asObservable().pipe(
		throttleTime(5000),
		switchMap((code) => this.filterCodes(code))
	);

	private readonly scanResult$ = (): Observable<Registration | undefined> =>
		this.scanResultFilter$.pipe(
			filter((value) => !!value),
			throttleTime(5000),
			switchMap((code) =>
				this.lookupService.getRegistrationByQrCode$(code!)
			),
			filter((registration) => !!registration),
			switchMap((registration) =>
				from(this.setRegistration(registration!))
			),
			catchError((error) =>
				from(this.missingRegistrationError(error)).pipe(
					filter((v) => !!v)
				)
			)
		);

	public readonly scanError = new Subject<Error>();
	private readonly scanError$ = this.scanError.asObservable().pipe(
		throttleTime(5000),
		switchMap((error) => this.scannerService.onScanError(error))
	);

	private readonly routeToReviewPage$ = (): Observable<boolean> =>
		this.scanResult$().pipe(
			switchMap(() =>
				from(this.router.navigate(['/admin/checkin/review']))
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
	) {
		// timer(3000).subscribe(() => {
		// 	this.scanResult.next('XE7UBKJC');
		// 	console.log('faked scan result');
		// });
	}

	public ionViewWillEnter(): void {
		this.scanErrorSubscription = this.scanError$.subscribe();
		this.routeToReviewPageSubscription =
			this.routeToReviewPage$().subscribe();

		this.cameraEnabled$.next(true);
	}

	public ionViewWillLeave(): void {
		this.scanErrorSubscription?.unsubscribe();
		this.scanErrorSubscription = undefined;
		this.routeToReviewPageSubscription?.unsubscribe();
		this.routeToReviewPageSubscription = undefined;
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

	public async filterCodes(code?: string): Promise<string | undefined> {
		if (code?.length) code = code.toUpperCase();
		if (code !== 'XE7UBKJC') return code;

		const alert = await this.alertController.create({
			header: 'Invalid code scanned',
			message: 'Manually type the code located below the QR image',
			buttons: [
				{ text: 'Cancel', role: 'cancel', cssClass: 'cancel-button' },
				{ text: 'OK', role: 'ok' },
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
			backdropDismiss: false,
		});

		this.disableScanner();

		await alert.present();
		const result = await alert.onDidDismiss();

		const value: string | undefined = result.data?.values[0];

		if (result.role === 'ok' && (value?.length ?? 0) >= 7) return value;

		return undefined;
	}

	public onScanResult(code: string): void {
		this.scanResult.next(code);
	}

	private async setRegistration(
		registration: Registration | Observable<undefined>
	): Promise<Registration | undefined> {
		if (isRegistration(registration)) {
			this.checkinContext.setRegistration(registration);
			return registration;
		}

		try {
			await firstValueFrom(registration);
		} catch {}

		return undefined;
	}

	private async missingRegistrationError(error: any): Promise<undefined> {
		const alert = await this.alertController.create({
			header: 'Error',
			message: error.message,
			buttons: [{ text: 'OK' }, { text: 'Try Search', role: 'search' }],
		});

		await alert.present();
		const { role } = await alert.onDidDismiss();

		if (role === 'search') this.router.navigate(['admin/search']);
		return undefined;
	}
}

export const isRegistration = (input: any): input is Registration =>
	!!(input as Registration).uid;
