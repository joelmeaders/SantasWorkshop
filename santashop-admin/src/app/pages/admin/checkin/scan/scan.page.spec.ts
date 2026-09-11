import { AuthService } from '@santashop/core/admin';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScanPage } from './scan.page';
import {
	provideFirestoreWrapperMock,
	provideAlertControllerMock,
	createScannerServiceMock,
	requireDefined,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { ScannerService } from './scanner.service';
import { RegistrationScanService } from '../../../../shared/services/registration-scan.service';
import { AnalyticsWrapper } from '@santashop/core/admin/firestore';
import { firstValueFrom, Subject } from 'rxjs';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { Component, input, output } from '@angular/core';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

@Component({
	// The stub must match the scanner library element.
	// eslint-disable-next-line @angular-eslint/component-selector
	selector: 'zxing-scanner',
	template: '',
	standalone: true,
})
class ZXingScannerStubComponent {
	public readonly formats = input<readonly unknown[]>([]);
	public readonly device = input<MediaDeviceInfo>();
	public readonly autostart = input(false);
	public readonly enable = input(false);
	public readonly delayBetweenScanSuccess = input(0);
	public readonly camerasFound = output<MediaDeviceInfo[]>();
	public readonly deviceChange = output<MediaDeviceInfo>();
	public readonly permissionResponse = output<boolean>();
	public readonly scanSuccess = output<string>();
	public readonly scanError = output<Error>();

	public readonly scanStop = vi.fn();
}

interface ScanPageInternals {
	scanResult: Subject<{ code: string; inputMethod: 'camera' | 'manual' } | undefined>;
	submitCameraScan: (code: string) => void;
}

describe('ScanPage', () => {
	let component: ScanPage;
	let fixture: ComponentFixture<ScanPage>;
	const resolve = vi.fn();
	const logEventWithParams = vi.fn();
	let realAlert: HTMLIonAlertElement | undefined;

	beforeEach(async () => {
		resolve.mockReset();
		logEventWithParams.mockReset();
		TestBed.overrideComponent(ScanPage, {
			remove: { imports: [ZXingScannerModule] },
			add: { imports: [ZXingScannerStubComponent] },
		});
		TestBed.configureTestingModule({
			imports: [ScanPage],
			providers: [
                { provide: AuthService, useValue: { currentUser$: of({ uid: 'staff-1' }) } },
				provideFirestoreWrapperMock(),
				provideAlertControllerMock(),
				{
					provide: ScannerService,
					useFactory: createScannerServiceMock,
				},
				{
					provide: RegistrationScanService,
					useValue: { resolve },
				},
				{
					provide: AnalyticsWrapper,
					useValue: { logEventWithParams },
				},
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ScanPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	afterEach(async () => {
		component.ionViewWillLeave();
		await realAlert?.dismiss();
		realAlert?.remove();
		realAlert = undefined;
	});

	async function openRealManualCodeAlert(): Promise<HTMLIonAlertElement> {
		const realAlerts = new AlertController();
		const alerts = TestBed.inject(AlertController);
		const didPresent = vi.fn();
		vi.mocked(alerts.create).mockImplementation(async (options) => {
			realAlert = await realAlerts.create({ ...options, animated: false });
			realAlert.addEventListener('ionAlertDidPresent', didPresent);
			return realAlert;
		});
		alerts.getTop = () => realAlerts.getTop();
		component.ionViewWillEnter();
		component.enterCodeManually();
		await vi.waitFor(() => expect(didPresent).toHaveBeenCalledOnce());
		return requireDefined(realAlert);
	}

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('normalizes a scan code while safely accepting an absent code', async () => {
		await expect(firstValueFrom(component.badCodeFilter())).resolves.toBeUndefined();
		await expect(firstValueFrom(component.badCodeFilter({
			code: 'ab12cd3',
			inputMethod: 'camera',
		}))).resolves.toEqual({ code: 'AB12CD3', inputMethod: 'camera' });
	});

	it('forwards camera events to the scanner service while it is inactive', () => {
		const scanner = fixture.debugElement.injector.get(ScannerService);
		const cameras = [{
			deviceId: 'rear',
			groupId: 'camera-group',
			kind: 'videoinput',
			label: 'Rear camera',
			toJSON: (): Record<string, never> => ({}),
		}] as MediaDeviceInfo[];
		const onCamerasFound = vi.spyOn(scanner, 'onCamerasFound');
		const onDeviceSelectChange = vi.spyOn(scanner, 'onDeviceSelectChange');
		const onDeviceChange = vi.spyOn(scanner, 'onDeviceChange');
		const onHasPermission = vi.spyOn(scanner, 'onHasPermission');

		component.onCamerasFound(cameras);
		component.onDeviceSelectChange({ detail: { value: 'rear' } });
		component.onDeviceChange(cameras[0]);
		component.onHasPermission(true);

		expect(onCamerasFound).toHaveBeenCalledWith(cameras);
		expect(onDeviceSelectChange).toHaveBeenCalledWith({ detail: { value: 'rear' } });
		expect(onDeviceChange).toHaveBeenCalledWith(cameras[0]);
		expect(onHasPermission).toHaveBeenCalledWith(true);
	});

	it('starts subscriptions on entry and deterministically stops them on leave', async () => {
		component.ionViewWillEnter();

		expect(component.cameraEnabled()).toBe(false);

		component.ionViewWillLeave();

		expect(component.cameraEnabled()).toBe(false);
	});

	it('resolves an eligible code, preserves the input method, and opens review', async () => {
		resolve.mockResolvedValue({
			disposition: 'eligible', registration: { uid: 'customer-1', qrcode: 'ABCDEFGH' },
		});
		const context = TestBed.inject(CheckInContextService);
		const setRegistration = vi.spyOn(context, 'setRegistration');
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		component.ionViewWillEnter();
		(component as unknown as ScanPageInternals).scanResult.next({ code: 'abcdefgh', inputMethod: 'manual' });
		await fixture.whenStable();

		expect(resolve).toHaveBeenCalledWith({ code: 'ABCDEFGH', inputMethod: 'manual' });
		expect(setRegistration).toHaveBeenCalledWith(expect.objectContaining({ uid: 'customer-1' }), 'manual');
		expect(navigate).toHaveBeenCalledWith(['/admin/checkin/review']);
		expect(logEventWithParams).toHaveBeenCalledWith('admin_registration_scan', {
			disposition: 'eligible', time_category: 'not_applicable',
		});
		component.ionViewWillLeave();
	});

	it('preserves blocked scan detail and routes duplicate-risk codes to the safety screen', async () => {
		const result = {
			disposition: 'duplicate-risk' as const,
			registration: { uid: 'customer-1' },
			attempt: { inputMethod: 'camera' },
		};
		resolve.mockResolvedValue(result);
		const context = TestBed.inject(CheckInContextService);
		const setBlockedScan = vi.spyOn(context, 'setBlockedScan');
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		component.ionViewWillEnter();
		(component as unknown as ScanPageInternals).scanResult.next({ code: 'ABCDEFGH', inputMethod: 'camera' });
		await fixture.whenStable();

		expect(setBlockedScan).toHaveBeenCalledWith(result);
		expect(navigate).toHaveBeenCalledWith(['/admin/checkin/duplicate', 'customer-1']);
		expect(logEventWithParams).toHaveBeenCalledWith('admin_registration_scan', {
			disposition: 'duplicate-risk', time_category: 'over_5_minutes',
		});
		component.ionViewWillLeave();
	});

	it('explains incomplete and unresolvable scan outcomes instead of navigating', async () => {
		resolve.mockResolvedValue({ disposition: 'incomplete', customerId: 'customer-1' });
		const alerts = TestBed.inject(AlertController);
		const create = vi.spyOn(alerts, 'create');
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		component.ionViewWillEnter();
		(component as unknown as ScanPageInternals).scanResult.next({ code: 'ABCDEFGH', inputMethod: 'camera' });
		await fixture.whenStable();

		expect(create).toHaveBeenCalledWith(expect.objectContaining({
			header: 'Oh No!',
			message: 'That registration is incomplete and cannot be checked in.',
		}));
		expect(navigate).not.toHaveBeenCalled();
		expect(logEventWithParams).toHaveBeenCalledWith('admin_registration_scan', {
			disposition: 'incomplete', time_category: 'not_applicable',
		});
		component.ionViewWillLeave();
	});

	it.each(['', 'XYZ', '123456789'])('keeps invalid manual code %j open with correction guidance', async (code) => {
		const alerts = TestBed.inject(AlertController);
		component.ionViewWillEnter();
		component.enterCodeManually();
		await fixture.whenStable();
		const alert = await vi.mocked(alerts.create).mock.results[0].value;
		const options = requireDefined(vi.mocked(alerts.create).mock.calls[0])[0] as {
			buttons: { role?: string; handler?: (value: Record<string, string>) => boolean }[];
		};
		const submit = requireDefined(
			requireDefined(options.buttons.find((button) => button.role === 'ok')).handler,
		);
		expect(submit({ 0: code })).toBe(false);
		expect(alert.message).toBe('Enter a code with 7 or 8 characters, as shown below the QR image.');
		expect(resolve).not.toHaveBeenCalled();
	});

	it.each(['abc1234', 'abc12345'])('accepts valid manual code %s once and routes its eligible result', async (code) => {
		resolve.mockResolvedValue({
			disposition: 'eligible', registration: { uid: 'manual-customer' },
		});
		const alerts = TestBed.inject(AlertController);
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		component.ionViewWillEnter();

		component.enterCodeManually();
		await fixture.whenStable();
		const options = requireDefined(vi.mocked(alerts.create).mock.calls[0])[0] as {
			buttons: { role?: string; handler?: (value: Record<string, string>) => boolean }[];
		};
		const submit = requireDefined(
			requireDefined(options.buttons.find((button) => button.role === 'ok')).handler,
		);
		expect(submit({ 0: code })).toBe(true);
		await fixture.whenStable();
		expect(resolve).toHaveBeenCalledExactlyOnceWith({ code: code.toUpperCase(), inputMethod: 'manual' });
		expect(navigate).toHaveBeenCalledWith(['/admin/checkin/review']);
		component.ionViewWillLeave();
	});

	it.each(['abc1234', 'abc12345'])('keeps the real Ionic alert open for invalid input then submits %s once', async (code) => {
		resolve.mockResolvedValue({ disposition: 'eligible', registration: { uid: 'manual-customer' } });
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		const alert = await openRealManualCodeAlert();
		const input = requireDefined(alert.querySelector('input'));
		const ok = requireDefined(alert.querySelector<HTMLButtonElement>('.alert-button-role-ok'));
		const didDismiss = vi.fn();
		alert.addEventListener('ionAlertDidDismiss', didDismiss);

		for (const invalidCode of ['', 'XYZ']) {
			input.value = invalidCode;
			input.dispatchEvent(new Event('input', { bubbles: true }));
			ok.click();
			await vi.waitFor(() => expect(alert.querySelector('.alert-message')?.textContent).toBe('Enter a code with 7 or 8 characters, as shown below the QR image.'));
			expect(alert.isConnected).toBe(true);
			expect(didDismiss).not.toHaveBeenCalled();
			expect(input.value).toBe(invalidCode);
			expect(resolve).not.toHaveBeenCalled();
		}

		input.value = code;
		input.dispatchEvent(new Event('input', { bubbles: true }));
		ok.click();
		await vi.waitFor(() => expect(didDismiss).toHaveBeenCalledOnce());
		expect(resolve).toHaveBeenCalledExactlyOnceWith({ code: code.toUpperCase(), inputMethod: 'manual' });
		expect(navigate).toHaveBeenCalledExactlyOnceWith(['/admin/checkin/review']);
	});

	it('dismisses the real manual-code alert with Cancel without resolving a registration', async () => {
		const alert = await openRealManualCodeAlert();
		const didDismiss = alert.onDidDismiss();
		requireDefined(alert.querySelector<HTMLButtonElement>('.alert-button-role-cancel')).click();
		await didDismiss;
		expect(alert.isConnected).toBe(false);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('surfaces validation errors from the registration resolver', async () => {
		resolve.mockRejectedValueOnce(new Error('Resolver unavailable'));
		const alerts = TestBed.inject(AlertController);
		component.ionViewWillEnter();
		(component as unknown as ScanPageInternals).submitCameraScan('ABCDEFGH');
		await fixture.whenStable();
		expect(alerts.create).toHaveBeenCalledWith(expect.objectContaining({
			header: 'Unable to validate code', message: 'Resolver unavailable',
		}));
		component.ionViewWillLeave();
	});

	it('explains not-found scans and provides a search recovery action', async () => {
		resolve.mockResolvedValue({ disposition: 'not-found', customerId: 'missing' });
		const alerts = TestBed.inject(AlertController);
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		component.ionViewWillEnter();
		(component as unknown as ScanPageInternals).scanResult.next({ code: 'ZXCVBNM', inputMethod: 'camera' });
		await fixture.whenStable();
		const options = requireDefined(vi.mocked(alerts.create).mock.calls.at(-1))[0] as {
			message: string;
			buttons: { role?: string; handler?: () => Promise<boolean> }[];
		};
		expect(options.message).toBe('That registration could not be found');
		await requireDefined(
			requireDefined(options.buttons.find((button) => button.role === 'search')).handler,
		)();
		expect(navigate).toHaveBeenCalledWith(['admin/search']);
		component.ionViewWillLeave();
	});

	it('forwards scanner errors, enables the camera, and resets subscriptions when starting over', async () => {
		const scanner = fixture.debugElement.injector.get(ScannerService);
		const onScanError = vi.spyOn(scanner, 'onScanError').mockResolvedValue(undefined);
		component.ionViewWillEnter();
		component.enableCamera();
		component.scanError.next(new Error('Camera unavailable'));
		await fixture.whenStable();
		expect(onScanError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Camera unavailable' }));
		expect(component.cameraEnabled()).toBe(true);

		component.ionViewWillLeave();
		expect(component.cameraEnabled()).toBe(false);
	});
});
