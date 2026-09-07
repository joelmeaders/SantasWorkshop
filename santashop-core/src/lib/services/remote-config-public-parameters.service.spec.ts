import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultPublicParameters, type PublicParameters, type PublicParametersStatus } from '@santashop/models';
import { PUBLIC_PARAMETERS_RUNTIME, RemoteConfigPublicParametersSource, provideRemoteConfigPublicParameters, type PublicParametersRuntime } from './remote-config-public-parameters.service';

describe('RemoteConfigPublicParametersSource', () => {
	let runtime: PublicParametersRuntime;
	let update: (settings: unknown) => void;
	let listenerError: (error: unknown) => void;
	let source: RemoteConfigPublicParametersSource;
	let current: PublicParameters | undefined;
	let status: PublicParametersStatus | undefined;
	const unsubscribe = vi.fn();
	const changed = (): PublicParameters => ({ ...createDefaultPublicParameters(), messageEn: 'Maintenance notice' });
	const settle = async (): Promise<void> => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
	const start = async (): Promise<void> => {
		TestBed.configureTestingModule({ providers: [RemoteConfigPublicParametersSource, { provide: PUBLIC_PARAMETERS_RUNTIME, useValue: runtime }] });
		source = TestBed.inject(RemoteConfigPublicParametersSource);
		source.publicParameters$.subscribe((value) => { current = value; });
		source.status$.subscribe((value) => { status = value; });
		await settle();
	};
	beforeEach(() => {
		vi.useFakeTimers();
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
		unsubscribe.mockReset();
		runtime = {
			local: false,
			initialize: vi.fn().mockResolvedValue(undefined),
			refresh: vi.fn().mockResolvedValue(createDefaultPublicParameters()),
			listen: vi.fn((next, error): (() => void) => { update = next; listenerError = error; return unsubscribe; }),
		};
	});
	afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); vi.restoreAllMocks(); });

	it('emits release defaults immediately while initialization is pending', async () => {
		runtime.initialize = vi.fn(() => new Promise(() => undefined));
		await start();
		expect(current).toEqual(createDefaultPublicParameters());
		expect(runtime.refresh).not.toHaveBeenCalled();
	});

	it('uses activated cache while the first network read is pending', async () => {
		runtime.initialize = vi.fn().mockResolvedValue(changed());
		runtime.refresh = vi.fn(() => new Promise(() => undefined));
		await start();
		expect(current).toEqual(changed());
		expect(status?.source).toBe('remote');
	});

	it('accepts immediate updates and rejects malformed updates without replacing valid settings', async () => {
		await start();
		update(changed());
		expect(current).toEqual(changed());
		update({ maintenanceModeEnabled: true });
		expect(current).toEqual(changed());
		expect(status?.error).toBeTruthy();
		expect(runtime.listen).toHaveBeenCalledTimes(1);
	});

	it('retries failed reads at 10, 30, 60, then 300 seconds and retains settings', async () => {
		runtime.initialize = vi.fn().mockResolvedValue(changed());
		runtime.refresh = vi.fn().mockRejectedValue(new Error('offline'));
		await start();
		for (const [index, delay] of [10_000, 30_000, 60_000, 300_000].entries()) {
			await vi.advanceTimersByTimeAsync(delay - 1);
			expect(runtime.refresh).toHaveBeenCalledTimes(index + 1);
			await vi.advanceTimersByTimeAsync(1);
			expect(runtime.refresh).toHaveBeenCalledTimes(index + 2);
		}
		expect(current).toEqual(changed());
	});

	it('suspends retries while hidden and recovers on return to the foreground', async () => {
		runtime.refresh = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(changed());
		await start();
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
		document.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(120_000);
		expect(runtime.refresh).toHaveBeenCalledTimes(1);
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
		document.dispatchEvent(new Event('visibilitychange'));
		await settle();
		expect(current).toEqual(changed());
		expect(status?.error).toBeUndefined();
	});

	it('coalesces lifecycle requests and limits healthy refreshes to once per minute', async () => {
		await start();
		window.dispatchEvent(new Event('online'));
		expect(runtime.refresh).toHaveBeenCalledTimes(1);
		let resolve: (value: unknown) => void = (): void => undefined;
		runtime.refresh = vi.fn(() => new Promise((done) => { resolve = done; }));
		await vi.advanceTimersByTimeAsync(60_000);
		const first = source.refresh();
		expect(source.refresh()).toBe(first);
		window.dispatchEvent(new Event('online'));
		expect(runtime.refresh).toHaveBeenCalledTimes(1);
		resolve(changed());
		await first;
		expect(current).toEqual(changed());
	});

	it('cleans up listener, retry timers and lifecycle handlers', async () => {
		await start();
		listenerError(new Error('disconnected'));
		source.ngOnDestroy();
		await vi.advanceTimersByTimeAsync(300_000);
		window.dispatchEvent(new Event('online'));
		expect(runtime.refresh).toHaveBeenCalledTimes(1);
		expect(unsubscribe).toHaveBeenCalledTimes(1);
	});

	it('keeps one-minute fallback fetches after a stream error until a real-time update succeeds', async () => {
		await start();
		listenerError(new Error('Stream stopped'));
		await vi.advanceTimersByTimeAsync(10_000);
		expect(runtime.refresh).toHaveBeenCalledTimes(2);
		expect(status?.error).toBe('Stream stopped');
		await vi.advanceTimersByTimeAsync(59_999);
		expect(runtime.refresh).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(runtime.refresh).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(runtime.refresh).toHaveBeenCalledTimes(4);
		update(changed());
		expect(status?.error).toBeUndefined();
		await vi.advanceTimersByTimeAsync(120_000);
		expect(runtime.refresh).toHaveBeenCalledTimes(5);
		expect(runtime.listen).toHaveBeenCalledTimes(1);
	});

	it('uses a visible watchdog when the real-time stream stays open without updates', async () => {
		await start();
		runtime.refresh = vi.fn().mockResolvedValue(changed());
		await vi.advanceTimersByTimeAsync(59_999);
		expect(runtime.refresh).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		await settle();
		expect(runtime.refresh).toHaveBeenCalledTimes(1);
		expect(current).toEqual(changed());
	});

	it('does not let the watchdog bypass degraded-stream retry backoff', async () => {
		runtime.refresh = vi.fn().mockRejectedValue(new Error('offline'));
		await start();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(runtime.refresh).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(29_999);
		expect(runtime.refresh).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(runtime.refresh).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(20_000);
		expect(runtime.refresh).toHaveBeenCalledTimes(3);
	});

	it('pauses the visible watchdog while hidden and resumes it when visible', async () => {
		await start();
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
		document.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(120_000);
		expect(runtime.refresh).toHaveBeenCalledTimes(1);
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
		document.dispatchEvent(new Event('visibilitychange'));
		await settle();
		expect(runtime.refresh).toHaveBeenCalledTimes(2);
	});

	it('suspends degraded-stream fallback while hidden and resumes it when visible', async () => {
		await start();
		listenerError(new Error('Stream stopped'));
		await vi.advanceTimersByTimeAsync(10_000);
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
		document.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(120_000);
		expect(runtime.refresh).toHaveBeenCalledTimes(2);
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
		document.dispatchEvent(new Event('visibilitychange'));
		await settle();
		expect(runtime.refresh).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(runtime.refresh).toHaveBeenCalledTimes(4);
	});

	it('polls only the explicit local adapter for emulator updates', async () => {
		runtime = { ...runtime, local: true, initialize: vi.fn().mockResolvedValue(changed()) };
		await start();
		expect(status?.source).toBe('local');
		expect(runtime.refresh).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(runtime.refresh).toHaveBeenCalledTimes(1);
	});

	it('keeps defaults when initialization fails and retries without registering duplicate listeners', async () => {
		runtime.initialize = vi.fn().mockRejectedValueOnce(new Error('Storage unavailable')).mockResolvedValue(changed());
		await start();
		expect(current).toEqual(createDefaultPublicParameters());
		expect(status?.error).toBe('Storage unavailable');
		expect(runtime.listen).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(runtime.listen).toHaveBeenCalledTimes(1);
		expect(status?.error).toBeUndefined();
	});

	it('constructs the emulator runtime without a Firebase app or any remote SDK initialization', async () => {
		const readLocal = vi.fn().mockResolvedValue(changed());
		TestBed.configureTestingModule({ providers: provideRemoteConfigPublicParameters({ useEmulator: true, readLocal }) });
		const localSource = TestBed.inject(RemoteConfigPublicParametersSource);
		let latest: PublicParameters | undefined;
		localSource.publicParameters$.subscribe((value) => { latest = value; });
		await settle();
		expect(readLocal).toHaveBeenCalledTimes(1);
		expect(latest).toEqual(changed());
	});
});
