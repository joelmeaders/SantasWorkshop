import {
  Component,
  ChangeDetectionStrategy,
  inject,
  viewChild
} from '@angular/core';
import { Router } from '@angular/router';
import {
	AlertController,
	IonContent,
	IonItem,
	IonIcon,
	IonSelect,
	IonSelectOption,
	PopoverOptions,
} from '@ionic/angular/standalone';
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
import { ZXingScannerComponent, ZXingScannerModule } from '@zxing/ngx-scanner';
import { filterNil } from '@santashop/core';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { AsyncPipe } from '@angular/common';
import { addIcons } from 'ionicons';
import { camera } from 'ionicons/icons';

@Component({
	selector: 'admin-scan',
	templateUrl: './scan.page.html',
	styleUrls: ['./scan.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		HeaderComponent,
		ZXingScannerModule,
		AsyncPipe,
		IonContent,
		IonItem,
		IonIcon,
		IonSelect,
		IonSelectOption,
	],
})
export class ScanPage {
	private readonly scannerService = inject(ScannerService);
	private readonly lookupService = inject(LookupService);
	private readonly checkinContext = inject(CheckInContextService);
	private readonly alertController = inject(AlertController);
	private readonly router = inject(Router);

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

	private readonly setRegistration$ = (): Observable<void | boolean> =>
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

	private readonly scanner = viewChild<ZXingScannerComponent>('scanner');

	protected readonly interfaceOptions: Partial<PopoverOptions> = {
		alignment: 'center',
		side: 'top',
		showBackdrop: true,
		backdropDismiss: true,
	};

	private routeToReviewPageSubscription?: Subscription;
	private scanErrorSubscription?: Subscription;
	private invalidCodeSubscription?: Subscription;

	constructor() {
		addIcons({ camera });
		addIcons({ camera });
		addIcons({ camera });
	}

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
		const scanner = this.scanner();
  if (scanner) {
			scanner.scanStop();
			scanner.enable = false;
			scanner.device = undefined;
		}
		this.cameraEnabled$.next(false);
	}

	public onCamerasFound(devices: MediaDeviceInfo[]): void {
		this.scannerService.onCamerasFound(devices);
	}

	public onDeviceSelectChange($event: { detail?: { value?: string } }): void {
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
		return of(code);
	}

	private async invalidCodeAlert(): Promise<void> {
		const alertOkHandler = (value: Record<string, string>): void => {
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
					handler: async (): Promise<boolean | undefined> =>
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
		await alert.onDidDismiss();
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
					handler: (): Promise<boolean> =>
						this.router.navigate(['admin/search']),
				},
			],
		});

		await alert.present();
	}
}
