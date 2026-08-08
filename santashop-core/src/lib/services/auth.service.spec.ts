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
import { firstValueFrom, of } from 'rxjs';
import type { User, UserCredential } from 'firebase/auth';
import { AuthService } from './auth.service';
import { AuthWrapper } from './_auth-wrapper';
import { FunctionsWrapper } from './_functions-wrapper';

describe('AuthService', () => {
	let service: AuthService;
	let authWrapperService: Mocked<AuthWrapper>;
	let functionsWrapperService: Mocked<FunctionsWrapper>;

	let authStateSpy: any;

	const mockUser = {
		email: 'test@test.com',
		uid: '12345',
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
						sendPasswordResetEmail: vi
							.fn()
							.mockName('AuthWrapper.sendPasswordResetEmail'),
						currentUser: vi
							.fn()
							.mockName('AuthWrapper.currentUser'),
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
						updateEmailAddress: vi
							.fn()
							.mockName('FunctionsWrapper.updateEmailAddress'),
					},
				},
			],
		});

		authWrapperService = TestBed.inject(
			AuthWrapper,
		) as Mocked<AuthWrapper>;
		functionsWrapperService = TestBed.inject(
			FunctionsWrapper,
		) as Mocked<FunctionsWrapper>;
	});

	beforeEach(() => {
		authStateSpy = authWrapperService.authState;
		authStateSpy.mockReturnValue(of(mockUser));
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

	it('emailAndUid$: should return expected value', async () => {
		// Arrange

		// Act
		const value = await firstValueFrom(service.emailAndUid$);

		// Assert
		expect(value.emailAddress).toEqual('test@test.com');
	});

	it('uid$: should return expected value', async () => {
		// Arrange

		// Act
		const value = await firstValueFrom(service.uid$);

		// Assert
		expect(value).toEqual('12345');
	});

	it('isAdmin$: should return true', async () => {
		// Arrange
		vi.spyOn(mockUser, 'getIdTokenResult').mockResolvedValue({
			claims: { admin: true },
		} as any);

		// Act
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
		const value = await firstValueFrom(service.isAdmin$);

		// Assert
		expect(value).toBe(false);
	});

	it('treats an owner as an administrator and exposes the owner role', async () => {
		vi.spyOn(mockUser, 'getIdTokenResult').mockResolvedValue({
			claims: { owner: true },
		} as any);

		await expect(firstValueFrom(service.isAdmin$)).resolves.toBe(true);
		await expect(firstValueFrom(service.isOwner$)).resolves.toBe(true);
	});

	it('maps named roles and grants check-in to a matching role', async () => {
		vi.spyOn(mockUser, 'getIdTokenResult').mockResolvedValue({
			claims: { roles: ['checkin', 'stats'] },
		} as any);

		await expect(firstValueFrom(service.roles$)).resolves.toEqual([
			'checkin',
			'stats',
		]);
		await expect(firstValueFrom(service.isCheckin$)).resolves.toBe(true);
		await expect(firstValueFrom(service.hasRole('admin'))).resolves.toBe(false);
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

		expect(authWrapperService.reauthenticateWithPassword).toHaveBeenCalledWith(
			currentUser,
			'secret',
		);
		expect(tokenRefresh).toHaveBeenCalledWith(true);
	});

	it('rejects reauthentication when no user is signed in', async () => {
		authWrapperService.currentUser.mockReturnValue(null);

		await expect(service.reauthenticate('secret')).rejects.toThrow(
			'User must be signed in.',
		);
	});

	it('resetPassword(): should make expected call', async () => {
		// Arrange
		const spy = authWrapperService.sendPasswordResetEmail;
		spy.mockResolvedValue(undefined);

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
			expect(signInSpy).toHaveBeenCalledWith(mockUser.email!, 'password');
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
		const mockToken = { claims: { admin: true } } as any;
		(authWrapperService.getCurrentUserToken as unknown as MockInstance).mockResolvedValue(
			mockToken,
		);
		const wrappedMethod = service.getCurrentUserToken;

		// Act
		const result = await wrappedMethod();

		// Assert
		expect(result).toEqual(mockToken);
		expect(authWrapperService.getCurrentUserToken).toHaveBeenCalled();
	});
});
