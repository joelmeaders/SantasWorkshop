import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScanPage } from './scan.page';
import {
	provideFirestoreWrapperMock,
	provideAlertControllerMock,
	createScannerServiceMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { ScannerService } from './scanner.service';
import { RegistrationScanService } from '../../../../shared/services/registration-scan.service';
import { AnalyticsWrapper } from '@santashop/core';
import { firstValueFrom, Subject } from 'rxjs';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';

interface ScanPageInternals {
	scanResult: Subject<{ code: string; inputMethod: 'camera' | 'manual' } | undefined>;
	submitCameraScan: (code: string) => void;
}

describe('ScanPage', () => {
	let component: ScanPage;
	let fixture: ComponentFixture<ScanPage>;
	const resolve = vi.fn();
	const logEventWithParams = vi.fn();

	beforeEach(async () => {
		resolve.mockReset();
		logEventWithParams.mockReset();
		TestBed.configureTestingModule({
			imports: [ScanPage],
			providers: [
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

		await expect(firstValueFrom(component.cameraEnabled$)).resolves.toBe(true);

		component.ionViewWillLeave();

		await expect(firstValueFrom(component.cameraEnabled$)).resolves.toBe(false);
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

	it('accepts a valid manual code, ignores a short one, and routes its eligible result', async () => {
		resolve.mockResolvedValue({
			disposition: 'eligible', registration: { uid: 'manual-customer' },
		});
		const alerts = TestBed.inject(AlertController);
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		component.ionViewWillEnter();

		component.enterCodeManually();
		await fixture.whenStable();
		const options = vi.mocked(alerts.create).mock.calls[0]![0] as {
			buttons: { role?: string; handler?: (value: Record<string, string>) => void }[];
		};
		const submit = options.buttons.find((button) => button.role === 'ok')!.handler!;
		submit({ 0: 'short' });
		await fixture.whenStable();
		expect(resolve).not.toHaveBeenCalled();

		submit({ 0: 'abc1234' });
		await fixture.whenStable();
		expect(resolve).toHaveBeenCalledWith({ code: 'ABC1234', inputMethod: 'manual' });
		expect(navigate).toHaveBeenCalledWith(['/admin/checkin/review']);
		component.ionViewWillLeave();
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
		const options = vi.mocked(alerts.create).mock.calls.at(-1)![0] as {
			message: string;
			buttons: { role?: string; handler?: () => Promise<boolean> }[];
		};
		expect(options.message).toBe('That registration could not be found');
		await options.buttons.find((button) => button.role === 'search')!.handler!();
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
		await expect(firstValueFrom(component.cameraEnabled$)).resolves.toBe(true);

		component.ionViewWillLeave();
		await expect(firstValueFrom(component.cameraEnabled$)).resolves.toBe(false);
	});
});
