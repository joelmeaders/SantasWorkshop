import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import {
	createModalControllerMock,
	provideTranslateServiceMock,
	createAppStateServiceMock,
	provideCustomerAnalyticsMock,
	provideCustomerAuthMock,
	provideCustomerFunctionsMock,
} from '../../test-helpers';

import { HomePage } from './home.page';
import { LoadingController, ModalController } from '@ionic/angular/standalone';
import { AppStateService, ErrorHandlerService } from '@santashop/core/customer';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AuthService } from '@santashop/core/customer';

describe('HomePage', () => {
	let component: HomePage;
	let fixture: ComponentFixture<HomePage>;
	const queryParamMap$ = new BehaviorSubject(convertToParamMap({}));
	const routeStub = {
		snapshot: { queryParamMap: convertToParamMap({}) },
		queryParamMap: queryParamMap$,
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [HomePage],
			providers: [
				{
					provide: AppStateService,
					useFactory: createAppStateServiceMock,
				},
				{
					provide: ModalController,
					useValue: createModalControllerMock(),
				},
				provideCustomerAnalyticsMock(),
				provideCustomerAuthMock(),
				provideCustomerFunctionsMock(),
				{
					provide: ErrorHandlerService,
					useValue: {
						handleError: vi
							.fn()
							.mockName('ErrorHandlerService.handleError'),
					},
				},
				{
					provide: LoadingController,
					useValue: {
						create: vi.fn().mockName('LoadingController.create'),
					},
				},
				provideTranslateServiceMock(),
				{
					provide: ActivatedRoute,
					useValue: routeStub,
				},
			],
		}).compileComponents();
		fixture = TestBed.createComponent(HomePage);
		component = fixture.componentInstance;
		routeStub.snapshot.queryParamMap = convertToParamMap({});
		queryParamMap$.next(convertToParamMap({}));
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('renders each account entry mode as the query parameter changes', async (): Promise<void> => {
		expect(fixture.nativeElement.querySelector('#createAccountButton')).toBeTruthy();

		queryParamMap$.next(convertToParamMap({ mode: 'sign-in' }));
		await fixture.whenStable();
		expect(fixture.nativeElement.querySelector('#signInButton')).toBeTruthy();

		queryParamMap$.next(convertToParamMap({ mode: 'reset' }));
		await fixture.whenStable();
		expect(fixture.nativeElement.querySelector('#resetPasswordButton')).toBeTruthy();
	});

	it('reserves the hero image geometry and prioritizes the Santa logo', (): void => {
		const logo = fixture.nativeElement.querySelector(
			'.hero-logo',
		) as HTMLImageElement;
		const gifts = fixture.nativeElement.querySelectorAll(
			'.hero-gift',
		) as NodeListOf<HTMLImageElement>;

		expect(logo.getAttribute('width')).toBe('491');
		expect(logo.getAttribute('height')).toBe('482');
		expect(logo.getAttribute('fetchpriority')).toBe('high');
		expect(gifts).toHaveLength(2);
		for (const gift of gifts) {
			expect(gift.getAttribute('width')).toBe('256');
			expect(gift.getAttribute('height')).toBe('256');
			expect(gift.getAttribute('fetchpriority')).toBe('low');
		}
	});

	it('does not create a sign-in request for an invalid form', async (): Promise<void> => {
		const loadingController = TestBed.inject(
			LoadingController,
		) as unknown as Mocked<LoadingController>;

		await component.onSignIn();

		expect(loadingController.create).not.toHaveBeenCalled();
	});

	it('signs in and returns to a permitted requested URL', async (): Promise<void> => {
		const authService = TestBed.inject(AuthService);
		const router = TestBed.inject(Router);
		const loader = {
			present: vi.fn().mockResolvedValue(undefined),
			dismiss: vi.fn().mockResolvedValue(undefined),
		};
		const loadingController = TestBed.inject(
			LoadingController,
		) as unknown as Mocked<LoadingController>;
		vi.spyOn(authService, 'login').mockResolvedValue({} as never);
		const navigateByUrl = vi
			.spyOn(router, 'navigateByUrl')
			.mockResolvedValue(true);
		loadingController.create.mockResolvedValue(loader as never);
		routeStub.snapshot.queryParamMap = convertToParamMap({
			returnUrl: '/pre-registration/profile',
		});
		component.signInForm.setValue({
			emailAddress: 'parent@example.com',
			password: 'secret123',
		});

		await component.onSignIn();

		expect(authService.login).toHaveBeenCalledWith({
			emailAddress: 'parent@example.com',
			password: 'secret123',
		});
		expect(navigateByUrl).toHaveBeenCalledWith('/pre-registration/profile');
		expect(loader.dismiss).toHaveBeenCalledOnce();
	});

	it('reports generic sign-in and reset-password failures while always dismissing the loader', async (): Promise<void> => {
		const authService = TestBed.inject(AuthService);
		const errorHandler = TestBed.inject(
			ErrorHandlerService,
		) as unknown as Mocked<ErrorHandlerService>;
		const loader = {
			present: vi.fn().mockResolvedValue(undefined),
			dismiss: vi.fn().mockRejectedValue(new Error('already dismissed')),
		};
		const loadingController = TestBed.inject(
			LoadingController,
		) as unknown as Mocked<LoadingController>;
		loadingController.create.mockResolvedValue(loader as never);
		vi.spyOn(authService, 'login').mockRejectedValue(new Error('sign-in failed'));
		vi.spyOn(authService, 'resetPassword').mockRejectedValue(
			new Error('reset failed'),
		);
		component.signInForm.setValue({
			emailAddress: 'parent@example.com',
			password: 'secret123',
		});
		component.resetEmail.setValue('parent@example.com');

		await component.onSignIn();
		await component.resetPassword();

		expect(errorHandler.handleError).toHaveBeenCalledTimes(2);
		expect(errorHandler.handleError).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				code: 'auth/sign-in-failed',
				message: 'Authentication failed',
			}),
			'translated',
		);
		expect(errorHandler.handleError).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				code: 'auth/password-reset-failed',
				message: 'Password reset failed',
			}),
			'translated',
		);
		expect(loader.dismiss).toHaveBeenCalledOnce();
	});

	it('shows the same reset confirmation when the account does not exist', async (): Promise<void> => {
		const authService = TestBed.inject(AuthService);
		const errorHandler = TestBed.inject(
			ErrorHandlerService,
		) as unknown as Mocked<ErrorHandlerService>;
		vi.spyOn(authService, 'resetPassword').mockRejectedValue({
			code: 'auth/user-not-found',
		});
		component.resetEmail.setValue('missing@example.com');

		await component.resetPassword();
		await fixture.whenStable();

		expect(await firstValueFrom(component.resetEmailSent$)).toBe(true);
		expect(errorHandler.handleError).not.toHaveBeenCalled();
	});

	it('marks a successful reset request as sent and can start another request', async (): Promise<void> => {
		const authService = TestBed.inject(AuthService);
		vi.spyOn(authService, 'resetPassword').mockResolvedValue(undefined);
		component.resetEmail.setValue('parent@example.com');

		await component.resetPassword();
		await fixture.whenStable();

		expect(await firstValueFrom(component.resetEmailSent$)).toBe(true);
		component.resetPasswordForm();
		expect(component.resetEmail.value).toBe('');
		expect(await firstValueFrom(component.resetEmailSent$)).toBe(false);
	});
});
