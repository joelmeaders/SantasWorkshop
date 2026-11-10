import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import {
	AnalyticsWrapper,
	AuthService,
	AuthWrapper,
	ErrorHandlerService,
	FireRepoLite,
	FunctionsWrapper,
} from '@santashop/core';
import type { User } from '@santashop/models';
import { BehaviorSubject, Subject, of } from 'rxjs';
import type { User as FirebaseUser, UserCredential } from 'firebase/auth';
import { PreRegistrationPage } from '../pre-registration.page';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePageService } from './profile.page.service';

describe('ProfilePageService', () => {
	const currentUser$ = new Subject<{ uid: string } | null>();
	const auth = {
		currentUser$,
		refreshCurrentUser: vi.fn(),
		changeEmailAddress: vi.fn(),
		changePassword: vi.fn(),
	};
	const read = vi.fn();
	const collection = vi.fn().mockReturnValue({ read });
	const functions = { changeAccountInformation: vi.fn() };
	const errors = { handleError: vi.fn() };
	const alert = { create: vi.fn() };
	const loading = { create: vi.fn() };
	const router = { navigate: vi.fn() };
	const analytics = { logEvent: vi.fn() };

	beforeEach(() => {
		read.mockReset();
		collection.mockClear();
		functions.changeAccountInformation.mockReset();
		errors.handleError.mockReset();
		alert.create.mockReset();
		loading.create.mockReset();
		router.navigate.mockReset();
		analytics.logEvent.mockReset();
		auth.changeEmailAddress.mockReset();
		auth.changePassword.mockReset();
		auth.refreshCurrentUser.mockReset();
		auth.refreshCurrentUser.mockResolvedValue(null);
		TestBed.configureTestingModule({
			providers: [
				ProfilePageService,
				{ provide: AuthService, useValue: auth },
				{ provide: FireRepoLite, useValue: { collection } },
				{ provide: FunctionsWrapper, useValue: functions },
				{ provide: ErrorHandlerService, useValue: errors },
				{ provide: AlertController, useValue: alert },
				{ provide: LoadingController, useValue: loading },
				{ provide: Router, useValue: router },
				{
					provide: TranslateService,
					useValue: {
						instant: vi.fn().mockReturnValue('translated'),
					},
				},
				{ provide: AnalyticsWrapper, useValue: analytics },
			],
		});
	});

	it('ignores signed-out auth emissions and loads the next authenticated profile', () => {
		const profile = {
			uid: 'customer-1',
			firstName: 'Holly',
			lastName: 'Jolly',
			zipCode: '80202',
		} as User;
		read.mockReturnValue(of(profile));

		const service = TestBed.inject(ProfilePageService);

		expect(() => currentUser$.next(null)).not.toThrow();
		expect(collection).not.toHaveBeenCalled();

		currentUser$.next({ uid: 'customer-1' });

		expect(read).toHaveBeenCalledWith('customer-1');
		expect(service.profileForm.value).toMatchObject({
			firstName: 'Holly',
			lastName: 'Jolly',
			zipCode: '80202',
		});
	});

	it('updates public profile, persists the local view, and always closes its loader', async (): Promise<void> => {
		read.mockReturnValue(
			of({
				uid: 'customer-1',
				firstName: 'Holly',
				lastName: 'Jolly',
				zipCode: '80202',
			} as User),
		);
		const loader = {
			present: vi.fn().mockResolvedValue(undefined),
			dismiss: vi.fn().mockResolvedValue(undefined),
		};
		loading.create.mockResolvedValue(loader);
		functions.changeAccountInformation.mockResolvedValue(undefined);
		router.navigate.mockResolvedValue(true);
		const service = TestBed.inject(ProfilePageService);
		currentUser$.next({ uid: 'customer-1' });
		service.profileForm.setValue({
			firstName: 'Noel',
			lastName: 'Bell',
			zipCode: '80203',
		});

		await service.updatePublicProfile();

		expect(functions.changeAccountInformation).toHaveBeenCalledWith({
			firstName: 'Noel',
			lastName: 'Bell',
			zipCode: '80203',
		});
		expect(auth.refreshCurrentUser).toHaveBeenCalledOnce();
		expect(analytics.logEvent).toHaveBeenCalledWith('profile_update_info');
		expect(loader.dismiss).toHaveBeenCalledOnce();
		expect(router.navigate).toHaveBeenCalledWith([
			'/pre-registration/profile',
		]);
	});

	it('presents the email and password completion confirmations', async (): Promise<void> => {
		const present = vi.fn().mockResolvedValue(undefined);
		const onDidDismiss = vi.fn().mockResolvedValue({ role: 'ok' });
		alert.create.mockResolvedValue({ present, onDidDismiss });
		const service = TestBed.inject(ProfilePageService);

		await expect(service.emailChangedAlert()).resolves.toEqual({
			role: 'ok',
		});
		await expect(service.passwordChangedAlert()).resolves.toEqual({
			role: 'ok',
		});

		expect(alert.create).toHaveBeenCalledTimes(2);
		expect(present).toHaveBeenCalledTimes(2);
	});

	it('changes email and password, then returns to the account page', async (): Promise<void> => {
		const present = vi.fn().mockResolvedValue(undefined);
		alert.create.mockResolvedValue({
			present,
			onDidDismiss: vi.fn().mockResolvedValue({}),
		});
		auth.changeEmailAddress.mockResolvedValue(undefined);
		auth.changePassword.mockResolvedValue(undefined);
		router.navigate.mockResolvedValue(true);
		const service = TestBed.inject(ProfilePageService);
		service.changeEmailForm.setValue({
			emailAddress: 'new@example.com',
			password: 'current-secret',
		});
		service.changePasswordForm.setValue({
			oldPassword: 'old-secret',
			newPassword: 'new-secret',
		});

		await service.changeEmailAddress();
		await service.changePassword();

		expect(auth.changeEmailAddress).toHaveBeenCalledWith(
			'current-secret',
			'new@example.com',
		);
		expect(auth.changePassword).toHaveBeenCalledWith(
			'old-secret',
			'new-secret',
		);
		expect(router.navigate).toHaveBeenCalledTimes(2);
		expect(
			service.changePasswordForm.controls.newPassword.value,
		).toBeFalsy();
		service.ngOnDestroy();
	});

	it.each(['', 'short', 'x'.repeat(41)])(
		'blocks password submission with invalid new password %s',
		async (password) => {
			const service = TestBed.inject(ProfilePageService);
			service.changePasswordForm.setValue({
				oldPassword: 'old-password',
				newPassword: password,
			});
			await service.changePassword();
			expect(auth.changePassword).not.toHaveBeenCalled();
			expect(alert.create).not.toHaveBeenCalled();
			expect(router.navigate).not.toHaveBeenCalled();
			expect(
				service.changePasswordForm.controls.newPassword.touched,
			).toBe(true);
		},
	);

	it('keeps the email editor available when an incomplete change needs a retry', async () => {
		const service = TestBed.inject(ProfilePageService);
		service.changeEmailForm.setValue({
			emailAddress: 'next@example.com',
			password: 'current-secret',
		});
		const error = new Error(
			'Your sign-in email changed. Save the same email again.',
		);
		auth.changeEmailAddress.mockRejectedValueOnce(error);
		await service.changeEmailAddress();
		expect(errors.handleError).toHaveBeenCalledWith(error);
		expect(service.changeEmailForm.value.emailAddress).toBe(
			'next@example.com',
		);
		expect(router.navigate).not.toHaveBeenCalled();
	});

	it('blocks an email change without a valid reauthentication password', async () => {
		const service = TestBed.inject(ProfilePageService);
		service.changeEmailForm.patchValue({ emailAddress: 'new@example.com' });
		await service.changeEmailAddress();
		expect(auth.changeEmailAddress).not.toHaveBeenCalled();
		expect(router.navigate).not.toHaveBeenCalled();
		expect(service.changeEmailForm.controls.password.touched).toBe(true);
	});
	it.each(['retry', 'sign-out', 'account-switch'])(
		'restores the real shell and profile editor after token invalidation, then handles %s',
		async (nextAction) => {
			const original = {
				uid: 'recover-ui',
				email: 'before@example.test',
				getIdToken: vi.fn().mockResolvedValue('token'),
			} as unknown as FirebaseUser;
			const updated = {
				...original,
				email: 'after@example.test',
			} as FirebaseUser;
			let sdkUser: FirebaseUser | null = original;
			const identities = new BehaviorSubject<FirebaseUser | null>(
				original,
			);
			let reloads = 0;
			const wrapper = {
				authState: (): BehaviorSubject<FirebaseUser | null> =>
					identities,
				currentUser: (): FirebaseUser | null => sdkUser,
				reloadCurrentUser: async (): Promise<FirebaseUser | null> => {
					if (++reloads === 2) {
						sdkUser = null;
						identities.next(null);
						throw { code: 'auth/user-token-expired' };
					}
					return sdkUser;
				},
				signInWithEmailAndPassword: async (
					email: string,
				): Promise<UserCredential> => {
					sdkUser = email === updated.email ? updated : original;
					identities.next(sdkUser);
					return { user: sdkUser } as UserCredential;
				},
			};
			const requests: unknown[] = [];
			const callable = vi.fn(async (request: unknown) => {
				requests.push(request);
				if (requests.length === 1)
					throw new Error('Lost committed response');
				return { data: true };
			});
			const navigateByUrl = vi.fn().mockResolvedValue(true);
			TestBed.overrideProvider(AuthWrapper, { useValue: wrapper });
			TestBed.overrideProvider(AuthService, {
				useFactory: () => new AuthService(),
			});
			TestBed.overrideProvider(FunctionsWrapper, {
				useValue: { updateEmailAddress: callable },
			});
			TestBed.overrideProvider(Router, {
				useValue: { navigate: router.navigate, navigateByUrl },
			});
			read.mockReturnValue(
				of({
					firstName: 'Family',
					lastName: 'Account',
					zipCode: '80202',
				}),
			);
			alert.create.mockResolvedValue({
				present: vi.fn(),
				onDidDismiss: vi.fn().mockResolvedValue({}),
			});
			const shell = TestBed.runInInjectionContext(
				() => new PreRegistrationPage(),
			);
			const service = TestBed.inject(ProfilePageService);
			service.changeEmailForm.setValue({
				emailAddress: updated.email!,
				password: 'test-password',
			});
			await service.changeEmailAddress();
			expect(shell.sessionActive()).toBe(true);
			expect(service.changeEmailForm.controls.emailAddress.value).toBe(
				updated.email,
			);
			expect(service.changeEmailForm.controls.password.value).toBeFalsy();
			expect(navigateByUrl).toHaveBeenLastCalledWith(
				'/pre-registration/profile',
				expect.any(Object),
			);
			if (nextAction !== 'retry') {
				sdkUser =
					nextAction === 'sign-out'
						? null
						: { ...original, uid: 'another-account' };
				identities.next(sdkUser);
				expect(shell.sessionActive()).toBe(false);
				expect(
					service.changeEmailForm.controls.emailAddress.value,
				).toBeNull();
				expect(service.recoveringEmail()).toBe(false);
				sdkUser = original;
				identities.next(original);
				expect(shell.sessionActive()).toBe(false);
				expect(
					service.changeEmailForm.controls.emailAddress.value,
				).toBeNull();
				service.ngOnDestroy();
				return;
			}
			service.changeEmailForm.controls.password.setValue('test-password');
			await service.changeEmailAddress();
			expect(requests).toHaveLength(2);
			expect(requests[1]).toEqual(requests[0]);
			sdkUser = null;
			identities.next(null);
			expect(shell.sessionActive()).toBe(false);
			expect(
				service.changeEmailForm.controls.emailAddress.value,
			).toBeNull();
			service.ngOnDestroy();
		},
	);

	it('clears profile and password forms and ignores a late prior-account read', () => {
		const first = new Subject<User | undefined>();
		const second = new Subject<User | undefined>();
		read.mockReturnValueOnce(first).mockReturnValue(second);
		const service = TestBed.inject(ProfilePageService);
		const values: (User | undefined)[] = [];
		const subscription = service.userProfile$.subscribe((value) =>
			values.push(value),
		);
		currentUser$.next({ uid: 'a' });
		first.next({
			firstName: 'Account A',
			lastName: 'Private',
			zipCode: '80202',
		} as User);
		service.changePasswordForm.patchValue({
			oldPassword: 'private-password',
		});
		currentUser$.next({ uid: 'b' });
		expect(values.at(-1)).toBeUndefined();
		expect(service.profileForm.value.firstName).toBeNull();
		expect(service.changePasswordForm.value.oldPassword).toBeNull();
		expect(first.observed).toBe(false);
		first.next({ firstName: 'Late A' } as User);
		second.next({ firstName: 'Account B' } as User);
		expect(values.at(-1)?.firstName).toBe('Account B');
		currentUser$.next(null);
		expect(values.at(-1)).toBeUndefined();
		expect(second.observed).toBe(false);
		subscription.unsubscribe();
	});
});
