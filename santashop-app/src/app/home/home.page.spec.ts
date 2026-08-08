import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import {
	createModalControllerMock,
	provideTranslateServiceMock,
	createAppStateServiceMock,
	provideAnalyticsMock,
	provideAuthMock,
	provideFunctionsMock,
} from '../../test-helpers';

import { HomePage } from './home.page';
import { LoadingController, ModalController } from '@ionic/angular';
import { AppStateService, ErrorHandlerService } from '@santashop/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AuthService } from '@santashop/core';

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
				provideAnalyticsMock(),
				provideAuthMock(),
				provideFunctionsMock(),
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

	it('reports sign-in and reset-password failures while always dismissing the loader', async (): Promise<void> => {
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
		expect(loader.dismiss).toHaveBeenCalledOnce();
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
