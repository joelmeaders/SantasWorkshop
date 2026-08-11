import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import {
	AuthService,
	ErrorHandlerService,
	FunctionsWrapper,
} from '@santashop/core/customer';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignUpPageService } from './sign-up.page.service';

describe('SignUpPageService', () => {
	const currentUser$ = new Subject<unknown>();
	const accountCallable = vi.fn();
	const callableWrapper = vi.fn().mockReturnValue(accountCallable);
	const login = vi.fn();
	const navigate = vi.fn().mockResolvedValue(true);
	const handleError = vi.fn();
	const loader = {
		message: '',
		present: vi.fn().mockResolvedValue(undefined),
		dismiss: vi.fn().mockResolvedValue(undefined),
	};
	const loadingCreate = vi.fn().mockResolvedValue(loader);
	const alert = {
		present: vi.fn().mockResolvedValue(undefined),
		onDidDismiss: vi.fn().mockResolvedValue({ role: 'sign-in' }),
	};
	const alertCreate = vi.fn().mockResolvedValue(alert);

	beforeEach(() => {
		accountCallable.mockReset().mockResolvedValue({ data: undefined });
		callableWrapper.mockClear();
		login.mockReset().mockResolvedValue(undefined);
		navigate.mockClear();
		handleError.mockClear();
		loader.message = '';
		loader.present.mockClear();
		loader.dismiss.mockClear();
		loadingCreate.mockClear();
		alert.present.mockClear();
		alert.onDidDismiss.mockReset().mockResolvedValue({ role: 'sign-in' });
		alertCreate.mockClear();

		TestBed.configureTestingModule({
			providers: [
				SignUpPageService,
				{
					provide: AuthService,
					useValue: { currentUser$, login },
				},
				{
					provide: FunctionsWrapper,
					useValue: { callableWrapper },
				},
				{ provide: Router, useValue: { navigate } },
				{
					provide: LoadingController,
					useValue: { create: loadingCreate },
				},
				{
					provide: ErrorHandlerService,
					useValue: { handleError },
				},
				{
					provide: AlertController,
					useValue: { create: alertCreate },
				},
				{
					provide: TranslateService,
					useValue: { instant: vi.fn((key: string) => key) },
				},
			],
		});
	});

	function createService(): SignUpPageService {
		const service = TestBed.inject(SignUpPageService);
		service.form.setValue({
			firstName: 'Holly',
			lastName: 'Jolly',
			emailAddress: 'holly@example.com',
			password: 'Password123!',
			password2: 'Password123!',
			zipCode: 80202,
			referredBy: 'Friend',
			legal: true,
			newsletter: true,
		});
		return service;
	}

	it('creates the account, signs in, and navigates to registration', async () => {
		const service = createService();

		await service.onboardUser();

		expect(callableWrapper).toHaveBeenCalledWith('newAccount');
		expect(accountCallable).toHaveBeenCalledWith(
			expect.objectContaining({
				emailAddress: 'holly@example.com',
				referredBy: 'Friend',
			}),
		);
		expect(login).toHaveBeenCalledWith({
			emailAddress: 'holly@example.com',
			password: 'Password123!',
		});
		expect(navigate).toHaveBeenCalledWith([
			'pre-registration/overview',
		]);
		expect(loader.present).toHaveBeenCalled();
		expect(loader.dismiss).toHaveBeenCalled();
	});

	it('offers recovery actions when the account already exists', async () => {
		const service = createService();
		accountCallable.mockRejectedValue({ code: 'functions/already-exists' });
		alert.onDidDismiss.mockResolvedValue({ role: 'reset' });

		await service.onboardUser();

		expect(alertCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				subHeader: 'holly@example.com',
				backdropDismiss: false,
			}),
		);
		expect(alert.present).toHaveBeenCalled();
		expect(navigate).toHaveBeenCalledWith(['/'], {
			queryParams: { mode: 'reset' },
		});
		expect(login).not.toHaveBeenCalled();
	});

	it('delegates unexpected account failures to the shared error handler', async () => {
		const service = createService();
		const error = { code: 'functions/internal', message: 'failed' };
		accountCallable.mockRejectedValue(error);

		await service.onboardUser();

		expect(handleError).toHaveBeenCalledWith(error);
		expect(alertCreate).not.toHaveBeenCalled();
		expect(loader.dismiss).toHaveBeenCalled();
	});

	it('redirects an already authenticated user and unsubscribes on destroy', () => {
		const service = createService();

		currentUser$.next({ uid: 'existing-user' });
		expect(navigate).toHaveBeenCalledWith([
			'/pre-registration/overview',
		]);

		navigate.mockClear();
		service.ngOnDestroy();
		currentUser$.next({ uid: 'another-user' });
		expect(navigate).not.toHaveBeenCalled();
	});
});
