import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AppStateService } from './app-state.service';
import { FireRepoLite } from './fire-repo-lite.service';
import { Observable, Subject, throwError } from 'rxjs';
import type { PublicParameters } from '@santashop/models';

vi.mock('firebase/firestore', () => ({
	addDoc: vi.fn(),
	collection: vi.fn(),
	deleteDoc: vi.fn(),
	doc: vi.fn(),
	onSnapshot: vi.fn(),
	query: vi.fn(),
	setDoc: vi.fn(),
	Timestamp: class {},
}));

describe('AppStateService', () => {
	let service: AppStateService;
	let publicParameters$: Subject<PublicParameters | null>;
	let read: ReturnType<typeof vi.fn>;

	const parameters = (overrides: Partial<PublicParameters> = {}): PublicParameters =>
		({
			admin: {
				preRegistrationEnabled: true,
				onsiteRegistrationEnabled: true,
				checkinEnabled: true,
				allowCancelRegistration: true,
				allowChangeRegistration: true,
			},
			maintenanceModeEnabled: true,
			registrationEnabled: true,
			weatherModeEnabled: true,
			createAccountEnabled: true,
			messageEn: 'Hello',
			messageEs: 'Hola',
			globalAlert: { messageEn: 'Alert' },
			...overrides,
		}) as PublicParameters;

	beforeEach(() => {
		publicParameters$ = new Subject<PublicParameters | null>();
		read = vi.fn().mockReturnValue(publicParameters$);
		const mockFireRepoLite = {
			collection: vi
				.fn()
				.mockName('collection')
				.mockReturnValue({
					read,
				}),
		};

		TestBed.configureTestingModule({
			providers: [
				AppStateService,
				{ provide: FireRepoLite, useValue: mockFireRepoLite },
			],
		});
		service = TestBed.inject(AppStateService);
	});

	afterEach(() => TestBed.resetTestingModule());

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('maps public and admin flags from a shared parameter document', () => {
		const values: {
			preRegistration: boolean[];
			onsite: boolean[];
			checkin: boolean[];
			cancel: boolean[];
			change: boolean[];
			maintenance: boolean[];
			registration: boolean[];
			weather: boolean[];
			account: boolean[];
		} = {
			preRegistration: [],
			onsite: [],
			checkin: [],
			cancel: [],
			change: [],
			maintenance: [],
			registration: [],
			weather: [],
			account: [],
		};
		service.preRegistrationEnabled$.subscribe((value) =>
			values.preRegistration.push(value),
		);
		service.onsiteRegistrationEnabled$.subscribe((value) => values.onsite.push(value));
		service.checkinEnabled$.subscribe((value) => values.checkin.push(value));
		service.allowCancelRegistration$.subscribe((value) => values.cancel.push(value));
		service.allowChangeRegistration$.subscribe((value) => values.change.push(value));
		service.isMaintenanceModeEnabled$.subscribe((value) => values.maintenance.push(value));
		service.isRegistrationEnabled$.subscribe((value) => values.registration.push(value));
		service.shopClosedWeather$.subscribe((value) => values.weather.push(value));
		service.createAccountEnabled$.subscribe((value) => values.account.push(value));

		publicParameters$.next(parameters());

		expect(values).toEqual({
			preRegistration: [false, true], onsite: [false, true], checkin: [false, true],
			cancel: [false, true], change: [false, true], maintenance: [true],
			registration: [true], weather: [true], account: [true],
		});
		expect(read).toHaveBeenCalledWith('public');
	});

	it('deduplicates identical documents and exposes localized messages and alerts', () => {
		const registrations: boolean[] = [];
		const messages: unknown[] = [];
		const alerts: unknown[] = [];
		service.isRegistrationEnabled$.subscribe((value) => registrations.push(value));
		service.messageDoc$.subscribe((value) => messages.push(value));
		service.globalAlert$.subscribe((value) => alerts.push(value));
		const value = parameters();
		publicParameters$.next(value);
		publicParameters$.next({ ...value });

		expect(registrations).toEqual([true]);
		expect(messages).toEqual([{ messageEn: 'Hello', messageEs: 'Hola' }]);
		expect(alerts).toEqual([{ messageEn: 'Alert' }]);
	});

	it('falls back to false for admin flags when the parameter stream fails', () => {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				AppStateService,
				{
					provide: FireRepoLite,
					useValue: {
						collection: (): { read: () => Observable<never> } => ({
							read: (): Observable<never> => throwError(() => new Error('offline')),
						}),
					},
				},
			],
		});
		const errorService = TestBed.inject(AppStateService);
		const values: boolean[] = [];
		errorService.checkinEnabled$.subscribe((value) => values.push(value));
		expect(values).toEqual([false, false]);
	});

	it('stops active parameter subscriptions when destroyed', () => {
		const values: boolean[] = [];
		service.isRegistrationEnabled$.subscribe((value) => values.push(value));
		service.ngOnDestroy();
		publicParameters$.next(parameters());
		expect(values).toEqual([]);
	});
});
