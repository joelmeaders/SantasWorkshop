import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular/standalone';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import {
	AuthService,
	ErrorHandlerService,
	FunctionsWrapper,
} from '@santashop/core/customer';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../assets/i18n/en.json';
import es from '../../../assets/i18n/es.json';
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
		navigate.mockReset().mockResolvedValue(true);
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
				provideTranslateService(),
			],
		});
	});

	function createService(): SignUpPageService {
		const translate = TestBed.inject(TranslateService);
		translate.setTranslation('en', en);
		translate.setTranslation('es', es);
		translate.use('es');
		const service = TestBed.inject(SignUpPageService);
		service.form.setValue({
			firstName: 'Holly',
			lastName: 'Jolly',
			emailAddress: 'holly@example.com',
			password: 'Password123!',
			password2: 'Password123!',
			zipCode: '80202',
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
		expect(navigate).toHaveBeenCalledWith(['pre-registration/overview']);
		expect(loader.present).toHaveBeenCalled();
		expect(loader.dismiss).toHaveBeenCalled();
	});

	it('offers sign-in and password reset when account creation succeeds but sign-in fails', async () => {
		const service = createService();
		const error = {
			code: 'auth/network-request-failed',
			message: 'The sign-in request failed.',
		};
		login.mockRejectedValue(error);
		alert.onDidDismiss.mockResolvedValue({ role: 'sign-in' });

		await service.onboardUser();

		expect(alertCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				header: es.SIGNUP.ACCOUNT_CREATED,
				message: es.SIGNUP.ACCOUNT_CREATED_MESSAGE,
				subHeader: 'holly@example.com',
				buttons: expect.arrayContaining([
					expect.objectContaining({ role: 'reset' }),
					expect.objectContaining({ role: 'sign-in' }),
				]),
				backdropDismiss: false,
			}),
		);
		expect(alert.present).toHaveBeenCalled();
		expect(navigate).toHaveBeenCalledWith(['/'], {
			queryParams: { mode: 'sign-in' },
		});
		expect(handleError).not.toHaveBeenCalled();
	});

	it('uses the normal error handler when navigation fails after sign-in', async () => {
		const service = createService();
		const error = {
			code: 'navigation-failed',
			message: 'The registration route could not be opened.',
		};
		navigate.mockRejectedValue(error);

		await service.onboardUser();

		expect(login).toHaveBeenCalledWith({
			emailAddress: 'holly@example.com',
			password: 'Password123!',
		});
		expect(alertCreate).not.toHaveBeenCalled();
		expect(handleError).toHaveBeenCalledWith(error);
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

	it('presents neutral recovery guidance for an App Check rejection', async () => {
		const service = createService();
		const error = {
			code: 'functions/unauthenticated',
			message: 'The request was missing a valid App Check token.',
		};
		accountCallable.mockRejectedValue(error);

		await service.onboardUser();

		expect(handleError).toHaveBeenCalledWith(
			{
				...error,
				details: es.SIGNUP.VERIFICATION_FAILED_MESSAGE,
			},
			es.SIGNUP.VERIFICATION_FAILED,
		);
		expect(alertCreate).not.toHaveBeenCalled();
		expect(service.form.controls.emailAddress.value).toBe(
			'holly@example.com',
		);
	});

	it('redirects an already authenticated user and unsubscribes on destroy', () => {
		const service = createService();

		currentUser$.next({ uid: 'existing-user' });
		expect(navigate).toHaveBeenCalledWith(['/pre-registration/overview']);

		navigate.mockClear();
		service.ngOnDestroy();
		currentUser$.next({ uid: 'another-user' });
		expect(navigate).not.toHaveBeenCalled();
	});

	it.each([
		['en', en],
		['es', es],
	] as const)(
		'shows both translated progress phases in %s while each operation is pending',
		async (language, catalog) => {
			const service = createService();
			TestBed.inject(TranslateService).use(language);
			let createDone!: () => void;
			let loginDone!: () => void;
			accountCallable.mockReturnValue(
				new Promise<void>((resolve) => {
					createDone = resolve;
				}),
			);
			login.mockReturnValue(
				new Promise<void>((resolve) => {
					loginDone = resolve;
				}),
			);
			const pending = service.onboardUser();
			await vi.waitFor(() => expect(accountCallable).toHaveBeenCalled());
			expect(loadingCreate).toHaveBeenCalledWith({
				message: catalog.SIGNUP.CREATING_ACCOUNT,
			});
			expect(login).not.toHaveBeenCalled();
			createDone();
			await vi.waitFor(() => expect(login).toHaveBeenCalled());
			expect(loader.message).toBe(catalog.SIGNUP.SIGNING_IN);
			expect(loader.dismiss).not.toHaveBeenCalled();
			loginDone();
			await pending;
			expect(loader.dismiss).toHaveBeenCalled();
		},
	);
	it.each([
		' winter-pass-2026',
		'winter-pass-2026 ',
		' winter-pass-2026 ',
		'winter pass 2026',
	])(
		'uses the same raw password for signup and immediate sign-in',
		async (password) => {
			const service = createService();
			service.form.patchValue({ password, password2: password });
			expect(service.form.valid).toBe(true);
			await service.onboardUser();
			expect(accountCallable).toHaveBeenCalledWith(
				expect.objectContaining({ password, password2: password }),
			);
			expect(login).toHaveBeenCalledWith(
				expect.objectContaining({ password }),
			);
		},
	);
	it('uses the signup length boundaries and exact confirmation', () => {
		const service = createService();
		for (const length of [7, 8, 40, 41]) {
			service.form.patchValue({
				password: 'a'.repeat(length),
				password2: 'a'.repeat(length),
			});
			expect(service.form.valid).toBe(length === 8 || length === 40);
		}
		service.form.patchValue({
			password: ' winter-pass-2026 ',
			password2: 'winter-pass-2026',
		});
		expect(service.form.hasError('passwordMismatch')).toBe(true);
	});
});
