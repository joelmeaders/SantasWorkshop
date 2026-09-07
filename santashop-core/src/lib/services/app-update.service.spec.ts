import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { BehaviorSubject, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
	let service: AppUpdateService;
	let versionUpdates: Subject<VersionEvent>;
	let unrecoverable: Subject<{
		type: 'UNRECOVERABLE_STATE';
		reason: string;
	}>;
	let isStable: BehaviorSubject<boolean>;
	let checkForUpdate: ReturnType<typeof vi.fn>;

	const readyEvent = {
		type: 'VERSION_READY',
		currentVersion: { hash: 'current' },
		latestVersion: { hash: 'latest' },
	} as VersionEvent;

	const readyEventWithHash = (hash: string): VersionEvent =>
		({
			type: 'VERSION_READY',
			currentVersion: { hash: 'current' },
			latestVersion: { hash },
		} as VersionEvent);

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	beforeEach(() => {
		versionUpdates = new Subject<VersionEvent>();
		unrecoverable = new Subject();
		isStable = new BehaviorSubject(false);
		checkForUpdate = vi.fn().mockResolvedValue(false);

		TestBed.configureTestingModule({
			providers: [
				{
					provide: SwUpdate,
					useValue: {
						isEnabled: true,
						versionUpdates,
						unrecoverable,
						checkForUpdate,
					},
				},
				{
					provide: ApplicationRef,
					useValue: { isStable: isStable.asObservable() },
				},
			],
		});
		service = TestBed.inject(AppUpdateService);
	});

	it('shows a ready notice without activating the update', () => {
		versionUpdates.next(readyEvent);

		expect(service.notice()).toBe('ready');
		expect(checkForUpdate).not.toHaveBeenCalled();
	});

	it('keeps a dismissed notice dismissed for the same version and renotifies for a new version', () => {
		versionUpdates.next(readyEventWithHash('same-version'));
		service.dismiss();
		versionUpdates.next(readyEventWithHash('same-version'));

		expect(service.notice()).toBeNull();

		versionUpdates.next(readyEventWithHash('new-version'));

		expect(service.notice()).toBe('ready');
	});

	it('shows failed and unrecoverable notices without reloading', () => {
		versionUpdates.next({
			type: 'VERSION_INSTALLATION_FAILED',
			version: { hash: 'latest' },
			error: 'download failed',
		} as VersionEvent);
		expect(service.notice()).toBe('failed');

		unrecoverable.next({
			type: 'UNRECOVERABLE_STATE',
			reason: 'missing chunk',
		});
		expect(service.notice()).toBe('unrecoverable');
		expect(checkForUpdate).not.toHaveBeenCalled();
	});

	it('does not replace ready or unrecoverable notices with an installation failure', () => {
		versionUpdates.next(readyEvent);
		versionUpdates.next({
			type: 'VERSION_INSTALLATION_FAILED',
			version: { hash: 'latest' },
			error: 'download failed',
		} as VersionEvent);

		expect(service.notice()).toBe('ready');

		unrecoverable.next({
			type: 'UNRECOVERABLE_STATE',
			reason: 'missing chunk',
		});
		versionUpdates.next({
			type: 'VERSION_INSTALLATION_FAILED',
			version: { hash: 'latest' },
			error: 'download failed',
		} as VersionEvent);

		expect(service.notice()).toBe('unrecoverable');
	});

	it('checks after stability and handles a rejected check safely', async () => {
		checkForUpdate.mockRejectedValueOnce(new Error('offline'));
		isStable.next(true);

		await Promise.resolve();

		expect(checkForUpdate).toHaveBeenCalledOnce();
		expect(service.notice()).toBe('failed');
	});

	it('coalesces focus checks while an update check is in flight', async () => {
		vi.useFakeTimers();
		let resolveCheck!: (value: boolean) => void;
		const pendingCheck = new Promise<boolean>((resolve) => {
			resolveCheck = resolve;
		});
		checkForUpdate
			.mockImplementationOnce(() => pendingCheck)
			.mockResolvedValue(false);

		isStable.next(true);
		expect(checkForUpdate).toHaveBeenCalledOnce();

		vi.advanceTimersByTime(300_000);
		document.defaultView?.dispatchEvent(new Event('focus'));
		expect(checkForUpdate).toHaveBeenCalledOnce();

		resolveCheck(false);
		await Promise.resolve();
		vi.advanceTimersByTime(300_000);
		document.defaultView?.dispatchEvent(new Event('focus'));

		expect(checkForUpdate).toHaveBeenCalledTimes(2);
	});

	it('allows a new focus check after the five-minute throttle window', async () => {
		vi.useFakeTimers();
		isStable.next(true);
		expect(checkForUpdate).toHaveBeenCalledOnce();

		vi.advanceTimersByTime(299_999);
		document.defaultView?.dispatchEvent(new Event('focus'));
		expect(checkForUpdate).toHaveBeenCalledOnce();

		vi.advanceTimersByTime(1);
		await Promise.resolve();
		document.defaultView?.dispatchEvent(new Event('focus'));
		expect(checkForUpdate).toHaveBeenCalledTimes(2);
	});

	it('unsubscribes from update events when the service is destroyed', () => {
		TestBed.resetTestingModule();
		versionUpdates.next(readyEvent);
		isStable.next(true);

		expect(checkForUpdate).not.toHaveBeenCalled();
		expect(service.notice()).toBeNull();
	});

	it('does not subscribe or check when service workers are disabled', async () => {
		TestBed.resetTestingModule();
		const disabledVersionUpdates = new Subject<VersionEvent>();
		const disabledStable = new BehaviorSubject(true);
		const disabledCheck = vi.fn().mockResolvedValue(false);
		TestBed.configureTestingModule({
			providers: [
				{
					provide: SwUpdate,
					useValue: {
						isEnabled: false,
						versionUpdates: disabledVersionUpdates,
						unrecoverable: new Subject(),
						checkForUpdate: disabledCheck,
					},
				},
				{
					provide: ApplicationRef,
					useValue: { isStable: disabledStable.asObservable() },
				},
			],
		});
		const disabledService = TestBed.inject(AppUpdateService);
		disabledVersionUpdates.next(readyEvent);
		await Promise.resolve();

		expect(disabledService.isEnabled).toBe(false);
		expect(disabledService.notice()).toBeNull();
		expect(disabledCheck).not.toHaveBeenCalled();
	});

	it('remains safe when service-worker support is not provided', () => {
		TestBed.resetTestingModule();
		const unavailableStable = new BehaviorSubject(false);
		TestBed.configureTestingModule({
			providers: [
				{
					provide: ApplicationRef,
					useValue: { isStable: unavailableStable.asObservable() },
				},
			],
		});

		const unavailableService = TestBed.inject(AppUpdateService);
		unavailableStable.next(true);

		expect(unavailableService.isEnabled).toBe(false);
		expect(unavailableService.notice()).toBeNull();
	});

	it('dismisses a notice without activating or checking an update', () => {
		versionUpdates.next(readyEvent);
		service.dismiss();

		expect(service.notice()).toBeNull();
		expect(checkForUpdate).not.toHaveBeenCalled();
	});
});
