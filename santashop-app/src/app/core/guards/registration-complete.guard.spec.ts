import {
	beforeEach,
	describe,
	expect,
	it,
	type Mocked,
	vi,
} from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { PreRegistrationService } from '../services/pre-registration.service';
import { RegistrationCompleteGuard } from './registration-complete.guard';

describe('RegistrationCompleteGuard', () => {
	let guard: RegistrationCompleteGuard;
	let preregistrationService: Mocked<PreRegistrationService>;
	let router: Mocked<Router>;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				{
					provide: Router,
					useValue: {
						parseUrl: vi.fn().mockName('Router.parseUrl'),
					},
				},
				{
					provide: PreRegistrationService,
					useValue: {
						registrationComplete$: of(false),
					},
				},
			],
		});
		preregistrationService = TestBed.inject(
			PreRegistrationService,
		) as Mocked<PreRegistrationService>;
		router = TestBed.inject(Router) as Mocked<Router>;
		guard = TestBed.inject(RegistrationCompleteGuard);
	});

	it('should be created', () => {
		expect(guard).toBeTruthy();
	});

	it('should return true when registration is not complete', async () => {
		// Arrange
		Object.defineProperty(preregistrationService, 'registrationComplete$', {
			get: () => of(false),
			configurable: true,
		});

		// Recreate guard with updated observable
		guard = TestBed.inject(RegistrationCompleteGuard);

		// Act
		const value = await firstValueFrom(guard.canActivate());

		// Assert
		expect(value).toBe(true);
	});

	it('should return urlTree when registration is complete', async () => {
		// Arrange
		const mockUrlTree = new UrlTree();
		router.parseUrl.mockReturnValue(mockUrlTree);

		// Reconfigure TestBed with new PreRegistrationService mock
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				{
					provide: Router,
					useValue: router,
				},
				{
					provide: PreRegistrationService,
					useValue: {
						registrationComplete$: of(true),
					},
				},
			],
		});

		// Get new guard instance
		guard = TestBed.inject(RegistrationCompleteGuard);

		// Act
		const value = await firstValueFrom(guard.canActivate());

		// Assert
		expect(value).toBeInstanceOf(UrlTree);
		expect(router.parseUrl).toHaveBeenCalledWith(
			'pre-registration/confirmation',
		);
	});
});
