import { DOCUMENT } from '@angular/common';
import { inject, Injectable, InjectionToken, OnDestroy, Provider } from '@angular/core';
import {
	createDefaultPublicParameters, parsePublicParameters, parsePublicParametersJson,
	defaultWaitingListSettings,
	parseWaitingListSettings,
	WAITING_LIST_REMOTE_CONFIG_KEY,
	type WaitingListSettings,
	PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY, PUBLIC_PARAMETERS_RETRY_DELAYS_MS,
	type PublicParameters, type PublicParametersStatus,
} from '@santashop/models';
import { BehaviorSubject, distinctUntilChanged } from 'rxjs';
import type { RemoteConfig } from 'firebase/remote-config';
import { FIREBASE_APP, PUBLIC_PARAMETERS_SOURCE, type PublicParametersSource } from '../tokens';

export interface RemoteConfigPublicParametersOptions {
	useEmulator: boolean;
	/** Reads the explicit emulator fixture. Must not read a deployed database. */
	readLocal?: () => Promise<unknown>;
	readLocalWaitingList?: () => Promise<unknown>;
}

export interface PublicParametersRuntime {
	readWaitingList?(): WaitingListSettings;
	readonly local: boolean;
	initialize(): Promise<unknown>;
	refresh(force?: boolean, fetchTimeoutMillis?: number): Promise<unknown>;
	listen(next: (settings: unknown) => void, error: (error: unknown) => void): () => void;
}

const OPTIONS = new InjectionToken<RemoteConfigPublicParametersOptions>('remote-config-public-parameters-options');
const REMOTE_WATCHDOG_INTERVAL_MS = 60_000;
const STARTUP_FETCH_TIMEOUT_MS = 3_000;
const STARTUP_RETRY_DELAY_MS = 2_000;

export const PUBLIC_PARAMETERS_RUNTIME = new InjectionToken<PublicParametersRuntime>('public-parameters-runtime', {
	factory: (): PublicParametersRuntime => {
		const options = inject(OPTIONS);
		if (options.useEmulator) {
			const read = options.readLocal;
			if (!read) throw new Error('An emulator settings reader is required.');
				let waitingList = defaultWaitingListSettings();
				const readBoth = async (): Promise<unknown> => {
					const settings = await read();
					try {
						waitingList = parseWaitingListSettings(
							await options.readLocalWaitingList?.(),
						);
					} catch {
						waitingList = defaultWaitingListSettings();
					}
					return settings;
				};
				return { local: true, initialize: readBoth, refresh: readBoth,
					readWaitingList: (): WaitingListSettings => waitingList,
					listen: (): (() => void) => (): void => undefined,
				};
		}
		const app = inject(FIREBASE_APP);
		let sdk: typeof import('firebase/remote-config') | undefined;
		let remote: RemoteConfig | undefined;
		const read = (): PublicParameters => {
			if (!remote || !sdk) throw new Error('Remote Config is unavailable.');
			const value = sdk.getValue(remote, PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY);
			if (value.getSource() !== 'remote') throw new Error('Remote settings are missing.');
			return parsePublicParametersJson(value.asString());
		};
		return {
			local: false,
				readWaitingList: (): WaitingListSettings => {
					try {
						if (!remote || !sdk) return defaultWaitingListSettings();
						const value = sdk.getValue(remote, WAITING_LIST_REMOTE_CONFIG_KEY);
						return value.getSource() === 'remote'
							? parseWaitingListSettings(
									JSON.parse(value.asString()) as unknown,
								)
							: defaultWaitingListSettings();
					} catch {
						return defaultWaitingListSettings();
					}
				},
				initialize: async (): Promise<unknown> => {
				// Keep settings SDK code out of the startup bundle and emulator sessions.
				sdk = await import('firebase/remote-config');
				if (!(await sdk.isSupported())) throw new Error('Remote Config is unsupported in this browser.');
				remote = sdk.getRemoteConfig(app);
				remote.settings.minimumFetchIntervalMillis = 60_000;
				remote.settings.fetchTimeoutMillis = 10_000;
				await sdk.ensureInitialized(remote);
				// A first visit has no activated value. The source already holds release defaults.
				try { return read(); } catch { return undefined; }
			},
			refresh: async (force = false, fetchTimeoutMillis?: number): Promise<unknown> => {
				if (!remote || !sdk) throw new Error('Remote Config is unavailable.');
				const minimumFetchIntervalMillis = remote.settings.minimumFetchIntervalMillis;
				const configuredFetchTimeoutMillis = remote.settings.fetchTimeoutMillis;
				if (force) remote.settings.minimumFetchIntervalMillis = 0;
				if (fetchTimeoutMillis !== undefined) remote.settings.fetchTimeoutMillis = fetchTimeoutMillis;
				try { await sdk.fetchAndActivate(remote); }
				finally {
					if (force) remote.settings.minimumFetchIntervalMillis = minimumFetchIntervalMillis;
					if (fetchTimeoutMillis !== undefined) remote.settings.fetchTimeoutMillis = configuredFetchTimeoutMillis;
				}
				return read();
			},
			listen: (next, error): (() => void) => {
				if (!remote || !sdk) return (): void => undefined;
				const activeRemote = remote;
				const activeSdk = sdk;
				return activeSdk.onConfigUpdate(activeRemote, {
					next: (): void => {
						void activeSdk.activate(activeRemote).then(() => next(read())).catch(error);
					},
					error,
					complete: (): void => error(new Error('Real-time settings updates stopped.')),
				});
			},
		};
	},
});

export const provideRemoteConfigPublicParameters = (options: RemoteConfigPublicParametersOptions): Provider[] => [
	{ provide: OPTIONS, useValue: options },
	RemoteConfigPublicParametersSource,
	{ provide: PUBLIC_PARAMETERS_SOURCE, useExisting: RemoteConfigPublicParametersSource },
];

/** One application-scoped source. Transient failures never replace the last valid settings. */
@Injectable()
export class RemoteConfigPublicParametersSource implements PublicParametersSource, OnDestroy {
	private readonly runtime = inject(PUBLIC_PARAMETERS_RUNTIME);
	private readonly document = inject(DOCUMENT);
	private readonly settings = new BehaviorSubject<PublicParameters>(
		createDefaultPublicParameters(),
	);
	private readonly waitingListSettings =
		new BehaviorSubject<WaitingListSettings>(defaultWaitingListSettings());
	public readonly waitingListSettings$ = this.waitingListSettings
		.asObservable()
		.pipe(
			distinctUntilChanged(
				(a, b) =>
					a.joiningEnabled === b.joiningEnabled &&
					a.emailSendingEnabled === b.emailSendingEnabled,
			),
		);
	private readonly status = new BehaviorSubject<PublicParametersStatus>({ source: 'defaults', refreshing: true,
	});
	private pending?: Promise<void>;
	private retryTimer?: ReturnType<typeof setTimeout>;
	private startupRetryTimer?: ReturnType<typeof setTimeout>;
	private startupRetryResolve?: (retry: boolean) => void;
	private watchdogTimer?: ReturnType<typeof setTimeout>;
	private localTimer?: ReturnType<typeof setInterval>;
	private unsubscribe?: () => void;
	private failures = 0;
	private streamError?: string;
	private lastAttempt = -Infinity;
	private destroyed = false;
	private initialized = false;

	public readonly publicParameters$ = this.settings.asObservable().pipe(
		distinctUntilChanged((previous, current) => JSON.stringify(previous) === JSON.stringify(current)),
	);
	public readonly status$ = this.status.asObservable();

	private readonly lifecycle = (): void => {
		if (this.document.visibilityState === 'hidden') {
			this.clearRetry();
			this.clearWatchdog();
			this.cancelStartupRetry();
			return;
		}
		void this.refresh();
		if (this.failures > 0 || this.streamError) this.scheduleRetry();
		this.scheduleWatchdog();
	};

	constructor() {
		this.document.addEventListener('visibilitychange', this.lifecycle);
		this.document.defaultView?.addEventListener('online', this.lifecycle);
		this.document.defaultView?.addEventListener('focus', this.lifecycle);
		this.pending = this.start().finally(() => { this.pending = undefined; });
	}

	private async start(): Promise<void> {
		this.lastAttempt = Date.now();
		this.status.next({ ...this.status.value, refreshing: true });
		try {
			const cached = await this.runtime.initialize();
			if (this.destroyed) return;
			this.initialized = true;
			if (cached !== undefined) this.accept(cached);
			try {
				this.unsubscribe = this.runtime.listen(
					(settings): void => { if (!this.destroyed) this.acceptUpdate(settings); },
					(error): void => { if (!this.destroyed) this.fail(error, true); },
				);
			} catch (error) { this.fail(error, true); }
			this.scheduleWatchdog();
			if (this.runtime.local) {
				this.localTimer = setInterval(() => this.lifecycle(), 1_000);
			} else {
				await this.performStartupRefresh();
			}
		} catch (error) { if (!this.destroyed) this.fail(error); }
	}

	private async performStartupRefresh(): Promise<void> {
		await this.performRefreshWithTimeout(STARTUP_FETCH_TIMEOUT_MS, false);
		if (this.destroyed || this.failures === 0 || this.document.visibilityState === 'hidden') return;
		if (!(await this.waitForStartupRetry())) return;
		if (this.destroyed || this.failures === 0) return;
		await this.performRefreshWithTimeout(STARTUP_FETCH_TIMEOUT_MS, true);
	}

	private async performRefreshWithTimeout(fetchTimeoutMillis: number, startup: boolean): Promise<void> {
		this.lastAttempt = Date.now();
		this.status.next({ ...this.status.value, refreshing: true });
		try {
			const value = await this.runtime.refresh(false, fetchTimeoutMillis);
			if (!this.destroyed) this.accept(value);
		} catch (error) {
			if (!this.destroyed) this.fail(error, false, startup || this.failures > 0);
		}
	}

	private waitForStartupRetry(): Promise<boolean> {
		this.clearRetry();
		return new Promise((resolve) => {
			this.startupRetryResolve = resolve;
			this.startupRetryTimer = setTimeout(() => {
				this.startupRetryTimer = undefined;
				this.startupRetryResolve = undefined;
				resolve(true);
			}, STARTUP_RETRY_DELAY_MS);
		});
	}

	private cancelStartupRetry(): void {
		if (this.startupRetryTimer !== undefined) clearTimeout(this.startupRetryTimer);
		this.startupRetryTimer = undefined;
		this.startupRetryResolve?.(false);
		this.startupRetryResolve = undefined;
	}

	public refresh(): Promise<void> {
		if (this.destroyed) return Promise.resolve();
		if (this.pending) return this.pending;
		if (Date.now() - this.lastAttempt < (this.runtime.local ? 1_000 : 60_000)) return Promise.resolve();
		return this.runRefresh();
	}

	private refreshScheduled(): void {
		if (this.destroyed || this.pending) return;
		void this.runRefresh(true);
	}

	private runRefresh(force = false): Promise<void> {
		this.pending = (this.initialized ? this.performRefresh(force) : this.start())
			.finally(() => { this.pending = undefined; });
		return this.pending;
	}

	private async performRefresh(force = false): Promise<void> {
		this.lastAttempt = Date.now();
		this.status.next({ ...this.status.value, refreshing: true });
		try {
			const value = await this.runtime.refresh(force);
			if (!this.destroyed) this.accept(value);
		} catch (error) { if (!this.destroyed) this.fail(error); }
	}

	private acceptUpdate(value: unknown): void {
		try { this.accept(value, true); } catch (error) { this.fail(error, true); }
	}

	private accept(value: unknown, fromStream = false): void {
		try {
			this.waitingListSettings.next(
				parseWaitingListSettings(this.runtime.readWaitingList?.()),
			);
		} catch {
			this.waitingListSettings.next(defaultWaitingListSettings());
		}
		const settings = parsePublicParameters(value);
		if (fromStream) this.streamError = undefined;
		this.settings.next(settings);
		this.failures = 0;
		this.clearRetry();
		this.status.next({ source: this.runtime.local ? 'local' : 'remote', refreshing: false, lastUpdatedAt: Date.now(), ...(this.streamError ? { error: this.streamError } : {}) });
		// A successful fetch does not prove the real-time connection recovered.
		if (this.streamError) this.scheduleRetry();
	}

	private fail(error: unknown, fromStream = false, schedule = true): void {
		this.failures++;
		const message = error instanceof Error ? error.message : 'Settings refresh failed.';
		if (fromStream) this.streamError = message;
		this.status.next({ ...this.status.value, refreshing: false, error: message });
		if (schedule) this.scheduleRetry();
	}

	private scheduleRetry(): void {
		this.clearRetry();
		if (this.destroyed || this.document.visibilityState === 'hidden' || this.startupRetryTimer !== undefined) return;
		const delay = this.failures > 0
			? (PUBLIC_PARAMETERS_RETRY_DELAYS_MS[
						Math.min(
							this.failures - 1, PUBLIC_PARAMETERS_RETRY_DELAYS_MS.length - 1,
						)
					] ?? 300_000)
				: Math.max(0, 60_000 - (Date.now() - this.lastAttempt));
		this.retryTimer = setTimeout(() => { if (!this.pending) void this.runRefresh(this.streamError !== undefined); }, delay);
	}

	private clearRetry(): void {
		if (this.retryTimer !== undefined) clearTimeout(this.retryTimer);
		this.retryTimer = undefined;
	}

	private scheduleWatchdog(): void {
		this.clearWatchdog();
		if (this.destroyed || this.runtime.local || this.document.visibilityState === 'hidden') return;
		this.watchdogTimer = setTimeout(() => {
			this.watchdogTimer = undefined;
			if (this.destroyed || this.document.visibilityState === 'hidden') return;
			// Retry timers own degraded-stream backoff. The watchdog only checks a healthy,
			// possibly stalled stream and must not shorten the 10/30/60/300 second delays.
			if (this.failures === 0 && !this.streamError) this.refreshScheduled();
			this.scheduleWatchdog();
		}, REMOTE_WATCHDOG_INTERVAL_MS);
	}

	private clearWatchdog(): void {
		if (this.watchdogTimer !== undefined) clearTimeout(this.watchdogTimer);
		this.watchdogTimer = undefined;
	}

	public ngOnDestroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.clearRetry();
		this.cancelStartupRetry();
		this.clearWatchdog();
		if (this.localTimer !== undefined) clearInterval(this.localTimer);
		this.unsubscribe?.();
		this.document.removeEventListener('visibilitychange', this.lifecycle);
		this.document.defaultView?.removeEventListener('online', this.lifecycle);
		this.document.defaultView?.removeEventListener('focus', this.lifecycle);
		this.settings.complete();
		this.waitingListSettings.complete();
		this.status.complete();
	}
}
