import { DOCUMENT } from '@angular/common';
import {
	ApplicationRef,
	DestroyRef,
	Injectable,
	inject,
	signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import {
	EMPTY,
	catchError,
	defer,
	exhaustMap,
	filter,
	from,
	fromEvent,
	merge,
	of,
	switchMap,
	take,
	throttleTime,
	type Observable,
} from 'rxjs';

export type AppUpdateNotice = 'ready' | 'failed' | 'unrecoverable' | null;

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
	private readonly applicationRef = inject(ApplicationRef);
	private readonly destroyRef = inject(DestroyRef);
	private readonly document = inject(DOCUMENT);
	private readonly swUpdate = inject(SwUpdate, { optional: true });
	private readonly noticeState = signal<AppUpdateNotice>(null);
	private readyVersionHash: string | undefined;

	public readonly isEnabled = this.swUpdate?.isEnabled ?? false;
	public readonly notice = this.noticeState.asReadonly();

	constructor() {
		if (!this.swUpdate?.isEnabled) return;

		this.listenForVersionUpdates();
		this.listenForUnrecoverableState();
		this.listenForUpdateChecks();
	}

	public dismiss(): void {
		this.noticeState.set(null);
	}

	public reload(): void {
		this.dismiss();
		this.document.defaultView?.location.reload();
	}

	private listenForVersionUpdates(): void {
		if (!this.swUpdate) return;

		this.swUpdate.versionUpdates
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((event: VersionEvent) => {
				if (
					event.type === 'VERSION_READY' &&
					event.latestVersion.hash !== this.readyVersionHash
				) {
					this.readyVersionHash = event.latestVersion.hash;
					this.noticeState.set('ready');
				}
				if (event.type === 'VERSION_INSTALLATION_FAILED') {
					if (
						this.noticeState() !== 'ready' &&
						this.noticeState() !== 'unrecoverable'
					) {
						this.noticeState.set('failed');
					}
				}
			});
	}

	private listenForUnrecoverableState(): void {
		if (!this.swUpdate) return;

		this.swUpdate.unrecoverable
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.noticeState.set('unrecoverable'));
	}

	private listenForUpdateChecks(): void {
		const window = this.document.defaultView;
		if (!window) return;

		const returnToApp$ = merge(
			fromEvent(window, 'focus'),
			fromEvent(this.document, 'visibilitychange').pipe(
				filter(() => this.document.visibilityState !== 'hidden'),
			),
		);

		this.applicationRef.isStable
			.pipe(
				filter(Boolean),
				take(1),
				switchMap(() =>
					merge(of(undefined), returnToApp$).pipe(
						throttleTime(300_000, undefined, {
							leading: true,
							trailing: false,
						}),
						exhaustMap(() => this.checkForUpdate()),
					),
				),
				takeUntilDestroyed(this.destroyRef),
			)
			.subscribe();
	}

	private checkForUpdate(): Observable<boolean> {
		const swUpdate = this.swUpdate;
		if (!swUpdate) return of(false);

		return defer(() => from(swUpdate.checkForUpdate())).pipe(
			catchError(() => {
				if (this.noticeState() === null) {
					this.noticeState.set('failed');
				}
				return EMPTY;
			}),
		);
	}
}
