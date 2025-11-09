import { inject, Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, of } from 'rxjs';
import {
	catchError,
	distinctUntilChanged,
	filter,
	map,
	shareReplay,
	startWith,
	takeUntil,
} from 'rxjs/operators';
import { COLLECTION_SCHEMA, PublicParameters } from '@santashop/models';
import { filterNil } from '../helpers';
import { FireRepoLite } from './fire-repo-lite.service';

/**
 * Combined app state service that manages application-wide state and parameters.
 * This service is used by both the admin and public apps.
 */
@Injectable({
	providedIn: 'root',
})
export class AppStateService implements OnDestroy {
	private readonly httpService = inject(FireRepoLite);

	private readonly destroy$ = new Subject<void>();

	/**
	 * Tracks the user's preferred color scheme.
	 * Initialized based on system preference.
	 */
	public prefersDark = globalThis.matchMedia('(prefers-color-scheme: dark)')
		.matches;

	/**
	 * Observable of public parameters from Firestore.
	 */
	private readonly publicDoc$: Observable<PublicParameters> = this.httpService
		.collection<PublicParameters>(COLLECTION_SCHEMA.parameters)
		.read('public')
		.pipe(
			takeUntil(this.destroy$),
			filterNil(),
			distinctUntilChanged((prev, curr) => {
				return JSON.stringify(prev) === JSON.stringify(curr);
			}),
			shareReplay(1),
		);

	// Admin-specific observables
	/**
	 * Whether pre-registration is enabled (admin).
	 */
	public readonly preRegistrationEnabled$: Observable<boolean> =
		this.publicDoc$.pipe(
			takeUntil(this.destroy$),
			map((value) => value.admin.preRegistrationEnabled),
			startWith(false),
			catchError(() => of(false)),
			shareReplay(1),
		);

	/**
	 * Whether onsite registration is enabled (admin).
	 */
	public readonly onsiteRegistrationEnabled$: Observable<boolean> =
		this.publicDoc$.pipe(
			takeUntil(this.destroy$),
			map((value) => value.admin.onsiteRegistrationEnabled),
			startWith(false),
			catchError(() => of(false)),
			shareReplay(1),
		);

	/**
	 * Whether check-in is enabled (admin).
	 */
	public readonly checkinEnabled$: Observable<boolean> = this.publicDoc$.pipe(
		takeUntil(this.destroy$),
		map((value) => value.admin.checkinEnabled),
		startWith(false),
		catchError(() => of(false)),
		shareReplay(1),
	);

	/**
	 * Whether users can cancel their registration (admin).
	 */
	public readonly allowCancelRegistration$: Observable<boolean> =
		this.publicDoc$.pipe(
			takeUntil(this.destroy$),
			map((value) => value.admin.allowCancelRegistration),
			startWith(false),
			catchError(() => of(false)),
			shareReplay(1),
		);

	// Public app-specific observables
	/**
	 * Whether maintenance mode is enabled (public app).
	 */
	public readonly isMaintenanceModeEnabled$ = this.publicDoc$.pipe(
		map((value) => value.maintenanceModeEnabled),
		takeUntil(this.destroy$),
	);

	/**
	 * Whether registration is enabled (public app).
	 */
	public readonly isRegistrationEnabled$ = this.publicDoc$.pipe(
		map((value) => value.registrationEnabled),
		takeUntil(this.destroy$),
	);

	/**
	 * Whether the shop is closed due to weather (public app).
	 */
	public readonly shopClosedWeather$ = this.publicDoc$.pipe(
		map((value) => value.weatherModeEnabled),
		takeUntil(this.destroy$),
	);

	/**
	 * Whether account creation is enabled (public app).
	 */
	public readonly createAccountEnabled$ = this.publicDoc$.pipe(
		map((value) => value.createAccountEnabled),
		takeUntil(this.destroy$),
	);

	/**
	 * Global alert configuration (public app).
	 * Provides the raw global alert data for display.
	 */
	public readonly globalAlert$ = this.publicDoc$.pipe(
		map((doc) => doc?.globalAlert ?? undefined),
		filter((value) => !!value),
		shareReplay(1),
	);

	/**
	 * Localized message from public parameters.
	 * Returns the message in the current language, or null if empty.
	 * Note: Requires TranslateService to be injected in the consuming component.
	 */
	public readonly messageDoc$ = this.publicDoc$.pipe(
		map((doc) => ({
			messageEn: doc.messageEn,
			messageEs: doc.messageEs,
		})),
		shareReplay(1),
	);

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}
}
