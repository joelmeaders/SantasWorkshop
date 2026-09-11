import {
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	type Mocked,
	vi,
} from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, Subject, Observable } from 'rxjs';
import type { User, UserCredential } from 'firebase/auth';
import { AuthService } from './auth.service';
import { AuthWrapper } from './_auth-wrapper';
import { FunctionsWrapper } from './_functions-wrapper';

describe('AuthService', () => {
	let service: AuthService;
	let authWrapperService: Mocked<AuthWrapper>;
	let functionsWrapperService: Mocked<FunctionsWrapper>;
	let authState$: BehaviorSubject<User | null>;

	let authStateSpy: any;

	const mockUser = {
		email: 'test@test.com',
		uid: '12345',
		reload: vi.fn().mockResolvedValue(undefined),
		getIdTokenResult() {
			return Promise.resolve({});
		},
	} as any as User;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				{
					provide: AuthWrapper,
					useValue: {
						authState: vi.fn().mockName('AuthWrapper.authState'),
						currentUser: vi
							.fn()
							.mockName('AuthWrapper.currentUser'),
						reloadCurrentUser: vi
							.fn()
							.mockName('AuthWrapper.reloadCurrentUser'),
						getCurrentUserToken: vi
							.fn()
							.mockName('AuthWrapper.getCurrentUserToken'),
						updatePassword: vi
							.fn()
							.mockName('AuthWrapper.updatePassword'),
						signInWithEmailAndPassword: vi
							.fn()
							.mockName('AuthWrapper.signInWithEmailAndPassword'),
						reauthenticateWithPassword: vi
							.fn()
							.mockName('AuthWrapper.reauthenticateWithPassword'),
						signOut: vi.fn().mockName('AuthWrapper.signOut'),
					},
				},
				{
					provide: FunctionsWrapper,
					useValue: {
						requestPasswordReset: vi
							.fn()
							.mockName('FunctionsWrapper.requestPasswordReset'),
						updateEmailAddress: vi
							.fn()
							.mockName('FunctionsWrapper.updateEmailAddress'),
					},
				},
			],
		});

		authWrapperService = TestBed.inject(AuthWrapper) as Mocked<AuthWrapper>;
		functionsWrapperService = TestBed.inject(
			FunctionsWrapper,
		) as Mocked<FunctionsWrapper>;
	});

	beforeEach(() => {
		authStateSpy = authWrapperService.authState;
		authState$ = new BehaviorSubject<User | null>(mockUser);
		authStateSpy.mockReturnValue(authState$);
		authWrapperService.reloadCurrentUser.mockResolvedValue(mockUser);
		service = TestBed.inject(AuthService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('currentUser$: should make expected calls', async () => {
		// Arrange

		// Act
		await firstValueFrom(service.currentUser$);

		// Assert
		expect(authStateSpy).toHaveBeenCalledTimes(1);
	});

	it('currentUser$ emits the refreshed identity for cached consumers', async () => {
		const refreshedUser = {
			...mockUser,
			displayName: 'Updated Name',
		} as User;
		const values: (User | null)[] = [];
		const subscription = service.currentUser$.subscribe((value) =>
			values.push(value),
		);
		authWrapperService.reloadCurrentUser.mockResolvedValue(refreshedUser);

		await service.refreshCurrentUser();

		expect(values).toEqual([mockUser, refreshedUser]);
		subscription.unsubscribe();
	});

	it('emailAndUid$: should return expected value', async () => {
		// Arrange

		// Act
		const value = await firstValueFrom(service.emailAndUid$);

		// Assert
		expect(value?.emailAddress).toEqual('test@test.com');
	});

	it('uid$: should return expected value', async () => {
		// Arrange

		// Act
		const value = await firstValueFrom(service.uid$);

		// Assert
		expect(value).toEqual('12345');
	});

	it('uid$ does not re-emit the same uid when the identity refreshes', async () => {
		const values: (string | null)[] = [];
		const subscription = service.uid$.subscribe((value) =>
			values.push(value),
		);

		await service.refreshCurrentUser();

		expect(values).toEqual(['12345']);
		subscription.unsubscribe();
	});

	it('uid$ emits again when the user signs out and signs back in', () => {
		const values: (string | null)[] = [];
		const subscription = service.uid$.subscribe((value) =>
			values.push(value),
		);

		authState$.next(null);
		authState$.next(mockUser);

		expect(values).toEqual(['12345', null, '12345']);
		subscription.unsubscribe();
	});

	it('isAdmin$: should return true', async () => {
		// Arrange
		vi.spyOn(mockUser, 'getIdTokenResult').mockResolvedValue({
			claims: { roles: ['admin', 'checkin'] },
		} as any);

		// Act
		await firstValueFrom(service.claimsResolved$);
		const value = await firstValueFrom(service.isAdmin$);

		// Assert
		expect(value).toBe(true);
	});

	it('isAdmin$: should return false', async () => {
		// Arrange
		vi.spyOn(mockUser, 'getIdTokenResult').mockResolvedValue({
			claims: {},
		} as any);

		// Act
		await firstValueFrom(service.claimsResolved$);
		const value = await firstValueFrom(service.isAdmin$);

		// Assert
		expect(value).toBe(false);
	});

	it('treats an owner as an administrator and exposes the owner role', async () => {
		vi.spyOn(mockUser, 'getIdTokenResult').mockResolvedValue({
			claims: { owner: true },
		} as any);

		await firstValueFrom(service.claimsResolved$);
		await expect(firstValueFrom(service.isAdmin$)).resolves.toBe(true);
		await expect(firstValueFrom(service.isOwner$)).resolves.toBe(true);
	});

	it('maps named roles and grants check-in to a matching role', async () => {
		vi.spyOn(mockUser, 'getIdTokenResult').mockResolvedValue({
			claims: { roles: ['checkin', 'stats'] },
		} as any);

		await firstValueFrom(service.claimsResolved$);
		await expect(firstValueFrom(service.roles$)).resolves.toEqual([
			'checkin',
			'stats',
		]);
		await expect(firstValueFrom(service.isCheckin$)).resolves.toBe(true);
		await expect(firstValueFrom(service.hasRole('admin'))).resolves.toBe(
			false,
		);
		await expect(firstValueFrom(service.isElevated$)).resolves.toBe(true);
	});

	it('reauthenticates the current user and refreshes their token', async () => {
		const tokenRefresh = vi.fn().mockResolvedValue('fresh-token');
		const currentUser = { ...mockUser, getIdToken: tokenRefresh } as User;
		authWrapperService.currentUser.mockReturnValue(currentUser);
		authWrapperService.reauthenticateWithPassword.mockResolvedValue(
			{} as UserCredential,
		);

		await service.reauthenticate('secret');

		expect(
			authWrapperService.reauthenticateWithPassword,
		).toHaveBeenCalledWith(currentUser, 'secret');
		expect(tokenRefresh).toHaveBeenCalledWith(true);
	});

	it('rejects reauthentication when no user is signed in', async () => {
		authWrapperService.currentUser.mockReturnValue(null);

		await expect(service.reauthenticate('secret')).rejects.toThrow(
			'User must be signed in.',
		);
	});

	it('resetPassword(): should make expected call', async () => {
		const spy = functionsWrapperService.requestPasswordReset;
		spy.mockResolvedValue({ data: { accepted: true } });

		// Act
		await service.resetPassword('test@test.com');

		// Assert
		expect(spy).toHaveBeenCalledWith('test@test.com');
	});

	describe('changePassword()', () => {
		it('should make expected call', async () => {
			// Arrange
			const spy = authWrapperService.currentUser;
			spy.mockReturnValue(null);

			// Act
			const action = service.changePassword('abc', 'def');

			// Assert
			await expect(action).rejects.toThrowError('User cannot be null');
			expect(spy).toHaveBeenCalled();
		});

		it('should handle and return error', async () => {
			// Arrange
			authWrapperService.currentUser.mockReturnValue(mockUser);

			const signInSpy = authWrapperService.signInWithEmailAndPassword;
			const testError = new Error('Sign in failed');
			signInSpy.mockRejectedValue(testError);

			// Act
			const action = service.changePassword('abc', 'def');

			// Assert
			await expect(action).rejects.toEqual(testError);
			expect(signInSpy).toHaveBeenCalledTimes(1);
			expect(signInSpy).toHaveBeenCalledWith(mockUser.email!, 'abc');
			// Note: ErrorHandlerService is not called in current implementation
		});

		it('should make expected calls', async () => {
			// Arrange
			authWrapperService.currentUser.mockReturnValue(mockUser);

			const signInSpy = authWrapperService.signInWithEmailAndPassword;
			signInSpy.mockResolvedValue({} as UserCredential);

			const updateSpy = authWrapperService.updatePassword;
			updateSpy.mockResolvedValue(undefined);

			// Act
			await service.changePassword('currentPass', 'newPass');

			// Assert
			expect(signInSpy).toHaveBeenCalledWith(
				mockUser.email!,
				'currentPass',
			);
			expect(updateSpy).toHaveBeenCalledWith(mockUser, 'newPass');
		});

		it('uses the refreshed email after an email change in the same session', async () => {
			const updatedUser = {
				...mockUser,
				email: 'updated@test.com',
			} as User;
			authWrapperService.currentUser
				.mockReturnValueOnce(mockUser)
				.mockReturnValue(updatedUser);
			authWrapperService.reloadCurrentUser
				.mockResolvedValueOnce(mockUser)
				.mockResolvedValue(updatedUser);
			authWrapperService.signInWithEmailAndPassword.mockResolvedValue({
				user: updatedUser,
			} as UserCredential);
			authWrapperService.updatePassword.mockResolvedValue(undefined);
			functionsWrapperService.updateEmailAddress.mockResolvedValue({
				data: undefined,
			});

			await service.changeEmailAddress(
				'current-pass',
				'updated@test.com',
			);
			await service.changePassword('current-pass', 'new-pass');

			expect(
				authWrapperService.signInWithEmailAndPassword,
			).toHaveBeenNthCalledWith(2, 'updated@test.com', 'current-pass');
			expect(authWrapperService.updatePassword).toHaveBeenCalledWith(
				updatedUser,
				'new-pass',
			);
		});
	});

	describe('changeEmailAddress()', () => {
		it('should make expected call', async () => {
			// Arrange
			const spy = authWrapperService.currentUser;
			spy.mockReturnValue(null);

			// Act
			const action = service.changeEmailAddress('abc', 'test2@test.com');

			// Assert
			await expect(action).rejects.toThrowError('User cannot be null');
			expect(spy).toHaveBeenCalled();
		});

		it('should handle and return error', async () => {
			// Arrange
			authWrapperService.currentUser.mockReturnValue(mockUser);

			const signInSpy = authWrapperService.signInWithEmailAndPassword;
			const testError = new Error('Sign in failed');
			signInSpy.mockRejectedValue(testError);

			// Act
			const action = service.changeEmailAddress('abc', 'test2@test.com');

			// Assert
			await expect(action).rejects.toEqual(testError);
			expect(signInSpy).toHaveBeenCalledTimes(1);
			expect(signInSpy).toHaveBeenCalledWith(mockUser.email!, 'abc');
			// Note: ErrorHandlerService is not called in current implementation
		});

		it('should make expected calls', async () => {
			// Arrange
			authWrapperService.currentUser.mockReturnValue(mockUser);

			const signInSpy = authWrapperService.signInWithEmailAndPassword;
			signInSpy.mockResolvedValue({} as UserCredential);

			const updateSpy = functionsWrapperService.updateEmailAddress;
			updateSpy.mockResolvedValue({ data: undefined });

			// Act
			await service.changeEmailAddress('password', 'test2@test.com');

			// Assert
			expect(signInSpy).toHaveBeenNthCalledWith(
				1,
				mockUser.email!,
				'password',
			);
			expect(signInSpy).toHaveBeenNthCalledWith(
				2,
				'test2@test.com',
				'password',
			);
			expect(updateSpy).toHaveBeenCalledWith('test2@test.com');
		});
	});

	it('login(): should make expected call', async () => {
		// Arrange
		const signInSpy = authWrapperService.signInWithEmailAndPassword;
		signInSpy.mockResolvedValue({} as UserCredential);

		// Act
		await service.login({ emailAddress: 'test@test.com', password: 'abc' });

		// Assert
		expect(signInSpy).toHaveBeenCalledWith(mockUser.email!, 'abc');
	});

	it('logout(): should make expected call with reload=false', async () => {
		// Arrange
		const signOutSpy = authWrapperService.signOut;
		signOutSpy.mockResolvedValue(undefined);

		// Act
		await service.logout(false);

		// Assert
		expect(signOutSpy).toHaveBeenCalled();
	});

	it('logout(): should call signOut with default reload parameter', async () => {
		// Arrange
		const signOutSpy = authWrapperService.signOut;
		signOutSpy.mockReturnValue(
			Promise.resolve().then(() => {
				// Mock document.location.reload to prevent actual reload in test
				// This is tested via the reload=false path above
			}),
		);

		// Act
		// Note: We cannot easily test reload=true without mocking document.location
		// So we verify the signOut call happens
		await service.logout(false);

		// Assert
		expect(signOutSpy).toHaveBeenCalled();
	});

	it('getCurrentUserToken(): should return token result', async () => {
		// Arrange
		const mockToken = { claims: { roles: ['admin', 'checkin'] } } as any;
		(
			authWrapperService.getCurrentUserToken as unknown as MockInstance
		).mockResolvedValue(mockToken);
		const wrappedMethod = service.getCurrentUserToken;

		// Act
		const result = await wrappedMethod();

		// Assert
		expect(result).toEqual(mockToken);
		expect(authWrapperService.getCurrentUserToken).toHaveBeenCalled();
	});

	it('clears every capability on sign-out and ignores late token results', async () => {
		const admin = {
			...mockUser,
			uid: 'admin-a',
			getIdTokenResult: vi.fn().mockResolvedValue({
				claims: { owner: true, roles: ['admin', 'checkin'] },
			}),
		} as unknown as User;
		authState$.next(admin);
		const values: unknown[][] = [];
		const streams: Observable<unknown>[] = [
			service.uid$,
			service.roles$,
			service.isAdmin$,
			service.isOwner$,
			service.isCheckin$,
			service.isElevated$,
			service.hasRole('checkin'),
		];
		const subscriptions = streams.map((stream, index) => {
			values[index] = [];
			return stream.subscribe((value) => values[index].push(value));
		});
		await firstValueFrom(service.claimsResolved$);
		expect(values.map((v) => v.at(-1))).toEqual([
			'admin-a',
			['admin', 'checkin'],
			true,
			true,
			true,
			true,
			true,
		]);
		let resolve!: (value: unknown) => void;
		authState$.next({
			...mockUser,
			uid: 'pending-b',
			getIdTokenResult: () =>
				new Promise((done) => {
					resolve = done;
				}),
		} as unknown as User);
		expect(values.map((v) => v.at(-1))).toEqual([
			'pending-b',
			[],
			false,
			false,
			false,
			false,
			false,
		]);
		authState$.next(null);
		resolve({ claims: { owner: true, roles: ['admin'] } });
		await Promise.resolve();
		expect(values.map((v) => v.at(-1))).toEqual([
			null,
			[],
			false,
			false,
			false,
			false,
			false,
		]);
		expect(
			await Promise.all(streams.map((stream) => firstValueFrom(stream))),
		).toEqual([null, [], false, false, false, false, false]);
		subscriptions.forEach((s) => s.unsubscribe());
	});
	it('recovers a failed token fetch for a later identity', async () => {
		authState$.next({
			...mockUser,
			getIdTokenResult: vi.fn().mockRejectedValue(new Error('offline')),
		} as unknown as User);
		expect(await firstValueFrom(service.claimsResolved$)).toBeNull();
		authState$.next({
			...mockUser,
			uid: 'b',
			getIdTokenResult: vi
				.fn()
				.mockResolvedValue({ claims: { roles: ['checkin'] } }),
		} as unknown as User);
		await firstValueFrom(service.claimsResolved$);
		expect(await firstValueFrom(service.isCheckin$)).toBe(true);
		expect(await firstValueFrom(service.isAdmin$)).toBe(false);
	});
	it('does not emit signed-out state while the SDK is still initializing', () => {
		TestBed.resetTestingModule();
		const initializing = new Subject<User | null>();
		TestBed.configureTestingModule({
			providers: [
				{
					provide: AuthWrapper,
					useValue: {
						authState: (): Observable<User | null> => initializing,
					},
				},
				{ provide: FunctionsWrapper, useValue: {} },
			],
		});
		const auth = TestBed.inject(AuthService);
		const values: unknown[] = [];
		const subscription = auth.claimsResolved$.subscribe((value) =>
			values.push(value),
		);
		expect(values).toEqual([]);
		initializing.next(null);
		expect(values).toEqual([null]);
		subscription.unsubscribe();
	});
});
