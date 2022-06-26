import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, Subject } from 'rxjs';
import { AppStateService } from './app-state.service';
import { RemoteConfigService } from './remote-config.service';

describe('AppStateService', () => {
	let service: AppStateService;
	let remoteConfigSpy: jasmine.SpyObj<RemoteConfigService>;
	let routerSpy: jasmine.SpyObj<Router>;

	const maintenanceMock = new Subject<boolean>();
	const registrationMock = new Subject<boolean>();
	const weatherMock = new Subject<boolean>();

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				{
					provide: RemoteConfigService,
					useValue: jasmine.createSpyObj<RemoteConfigService>(
						'RemoteConfigService',
						{},
						{
							maintenanceModeEnabled$:
								maintenanceMock.asObservable(),
							registrationEnabled$:
								registrationMock.asObservable(),
							shopClosedWeather$: weatherMock.asObservable(),
						}
					),
				},
				{
					provide: Router,
					useValue: jasmine.createSpyObj<Router>('router', [
						'navigate',
					]),
				},
			],
		});

		service = TestBed.inject(AppStateService);
		remoteConfigSpy = TestBed.inject(
			RemoteConfigService
		) as jasmine.SpyObj<RemoteConfigService>;
		routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should be closed for maintenance', async () => {
		// Arrange
		const mockedSpy = Object.getOwnPropertyDescriptor(
			remoteConfigSpy,
			'maintenanceModeEnabled$'
		)?.get as jasmine.Spy;

		// Act
		const value = firstValueFrom(service.isMaintenanceModeEnabled$);

		maintenanceMock.next(true);
		weatherMock.next(false);
		registrationMock.next(false);

		// Assert
		await expectAsync(value).toBeResolvedTo(true);
		expect(mockedSpy).toHaveBeenCalled();
		expect(routerSpy.navigate).toHaveBeenCalledWith(['/maintenance']);
	});

	it('registration should be disabled', async () => {
		// Arrange
		const mockedSpy = Object.getOwnPropertyDescriptor(
			remoteConfigSpy,
			'registrationEnabled$'
		)?.get as jasmine.Spy;

		// Act
		const value = firstValueFrom(service.isRegistrationEnabled$);

		maintenanceMock.next(false);
		weatherMock.next(false);
		registrationMock.next(false);

		// Assert
		await expectAsync(value).toBeResolvedTo(false);
		expect(mockedSpy).toHaveBeenCalled();
		expect(routerSpy.navigate).toHaveBeenCalledWith([
			'/registration-closed',
		]);
	});

	it('should be closed for weather', async () => {
		// Arrange
		const mockedSpy = Object.getOwnPropertyDescriptor(
			remoteConfigSpy,
			'shopClosedWeather$'
		)?.get as jasmine.Spy;

		// Act
		const value = firstValueFrom(service.shopClosedWeather$);

		maintenanceMock.next(false);
		weatherMock.next(true);
		registrationMock.next(false);

		// Assert
		await expectAsync(value).toBeResolvedTo(true);
		expect(mockedSpy).toHaveBeenCalled();
		expect(routerSpy.navigate).toHaveBeenCalledWith(['/bad-weather']);
	});
});
