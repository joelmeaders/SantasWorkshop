import { AdminLanguageService } from '../../../../shared/preferences/admin-language.service';
import { createAdminAlert } from '../../../../shared/preferences/admin-overlays';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import {
	Component,
	ChangeDetectionStrategy,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
	AlertController,
	IonContent,
	IonButton,
	IonItem,
	IonIcon,
	IonSelect,
	IonSelectOption,
	PopoverOptions,
} from '@ionic/angular/standalone';
import {
	catchError,
	distinctUntilChanged,
	EMPTY,
	from,
	Observable,
	of,
	Subject,
	Subscription,
	switchMap,
	tap,
	throttleTime,
} from 'rxjs';
import { ScannerService } from './scanner.service';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';
import { ZXingScannerComponent, ZXingScannerModule } from '@zxing/ngx-scanner';
import { AnalyticsWrapper, filterNil } from '@santashop/core/admin/firestore';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { addIcons } from 'ionicons';
import { camera } from 'ionicons/icons';
import {
	type ResolveRegistrationScanRequest,
	type ResolveRegistrationScanResult,
} from '@santashop/models';
import { RegistrationScanService } from '../../../../shared/services/registration-scan.service';

@Component({
	selector: 'admin-scan',
	templateUrl: './scan.page.html',
	styleUrls: ['./scan.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ScannerService],
	imports: [
		AdminTextPipe,
		HeaderComponent,
		ZXingScannerModule,
		IonContent,
		IonButton,
		IonItem,
		IonIcon,
		IonSelect,
		IonSelectOption,
	],
})
export class ScanPage {
	private readonly language = inject(AdminLanguageService);
	private readonly scannerService = inject(ScannerService);
	private readonly registrationScan = inject(RegistrationScanService);
	private readonly checkinContext = inject(CheckInContextService);
	private readonly analytics = inject(AnalyticsWrapper);
	private readonly alertController = inject(AlertController);
	private readonly router = inject(Router);

	public readonly cameraEnabled = signal(false);
	public readonly deviceId = toSignal(this.scannerService.$deviceId, {
		initialValue: '',
	});
	public readonly availableDevices = toSignal(
		this.scannerService.$availableDevices,
		{ initialValue: undefined },
	);
	public readonly formatsEnabled = this.scannerService.formatsEnabled;
	public readonly deviceToUse = toSignal(this.scannerService.$deviceToUse, {
		initialValue: undefined,
	});
	public readonly hasPermissions = toSignal(
		this.scannerService.$hasPermissions,
		{ initialValue: false },
	);

	protected readonly scanResult = new Subject<
		ResolveRegistrationScanRequest | undefined
	>();
	private readonly scanResultFilter$ = this.scanResult.asObservable().pipe(
		distinctUntilChanged(),
		throttleTime(3000),
		switchMap((request) => this.badCodeFilter(request)),
		filterNil(),
	);

	private readonly setRegistration$ = (): Observable<void | boolean> =>
		this.scanResultFilter$.pipe(
			tap((request) => (this.lastInputMethod = request.inputMethod)),
			switchMap((request) =>
				from(this.registrationScan.resolve(request)).pipe(
					catchError((error: unknown) =>
						from(this.scanResolutionError(error)).pipe(
							switchMap(() => EMPTY),
						),
					),
				),
			),
			switchMap((result) => {
				this.logDisposition(result);
				if (result.disposition === 'eligible') {
					this.checkinContext.setRegistration(
						result.registration,
						this.lastInputMethod,
					);
					return this.router.navigate(['/admin/checkin/review']);
				}
				if (
					result.disposition === 'duplicate-accidental' ||
					result.disposition === 'duplicate-risk' ||
					result.disposition === 'cancelled'
				) {
					this.checkinContext.setBlockedScan(result);
					return this.router.navigate([
						'/admin/checkin/duplicate',
						result.registration.uid,
					]);
				}
				return this.cannotFindRegistrationAlert(
					result.disposition === 'incomplete',
				);
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
	}

	public ionViewWillEnter(): void {
		this.scanErrorSubscription = this.scanError$.subscribe();
		this.routeToReviewPageSubscription =
			this.setRegistration$().subscribe();
		this.invalidCodeSubscription = this.notifyInvalidCode$.subscribe();

		// Keep camera access opt-in. Manual check-in is a complete flow and should
		// not trigger a permission prompt or camera startup cost on page entry.
		this.cameraEnabled.set(false);
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

	public disableScanner(): void {
		const scanner = this.scanner();
		if (scanner) {
			scanner.scanStop();
			scanner.enable = false;
			scanner.device = undefined;
		}
		this.cameraEnabled.set(false);
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

	public badCodeFilter(
		request?: ResolveRegistrationScanRequest,
	): Observable<ResolveRegistrationScanRequest | undefined> {
		if (!request) return of(undefined);
		return of({ ...request, code: request.code.toUpperCase() });
	}

	public enterCodeManually(): void {
		// Triggers the invalid code process so the user can enter the code manually
		this.invalidCode.next();
	}

	public enableCamera(): void {
		this.cameraEnabled.set(true);
	}

	private async invalidCodeAlert(): Promise<void> {
		let message = 'Manually type the code located below the QR image';
		const alertOkHandler = (value: Record<string, string>): boolean => {
			const code = (value[0] ?? '').trim();
			if (!/^[A-Za-z0-9]{8}$/.test(code)) {
				message =
					'Enter 8 letters or numbers, as shown below the QR image.';
				alert.message = this.language.text(message);
				return false;
			}
			this.scanResult.next({ code, inputMethod: 'manual' });
			return true;
		};

		const alert = await createAdminAlert(this.alertController, () => ({
			header: 'Enter registration code',
			message,
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
					placeholder: 'Code (8 letters or numbers)',
					attributes: {
						minlength: 8,
						maxlength: 8,
					},
				},
			],
			backdropDismiss: true,
		}));
		await alert.present();
		await alert.onDidDismiss();
	}

	private lastInputMethod: 'camera' | 'manual' = 'camera';

	protected submitCameraScan(code: string): void {
		this.lastInputMethod = 'camera';
		this.scanResult.next({ code, inputMethod: 'camera' });
	}

	private logDisposition(result: ResolveRegistrationScanResult): void {
		this.analytics.logEventWithParams('admin_registration_scan', {
			disposition: result.disposition,
			time_category:
				result.disposition === 'duplicate-accidental'
					? 'within_5_minutes'
					: result.disposition === 'duplicate-risk'
						? 'over_5_minutes'
						: 'not_applicable',
		});
	}

	private async cannotFindRegistrationAlert(
		incomplete = false,
	): Promise<void> {
		const alert = await createAdminAlert(this.alertController, () => ({
			header: 'Oh No!',
			message: incomplete
				? 'That registration is incomplete and cannot be checked in.'
				: 'That registration could not be found',
			buttons: [
				{ text: 'Ok' },
				{
					text: 'Try Search',
					role: 'search',
					handler: (): Promise<boolean> =>
						this.router.navigate(['admin/search']),
				},
			],
		}));

		await alert.present();
	}

	private async scanResolutionError(error: unknown): Promise<void> {
		const alert = await createAdminAlert(this.alertController, () => ({
			header: 'Unable to validate code',
			message:
				error instanceof Error
					? error.message
					: 'Try the scan again or contact a DSCS member.',
			buttons: ['OK'],
		}));
		await alert.present();
	}
}
