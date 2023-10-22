import { TestBed } from '@angular/core/testing';
import { ErrorHandlerService } from '@core/*';
import { firstValueFrom, of } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthWrapper, User, UserCredential } from './_auth-wrapper';
import { FunctionsWrapper } from './_functions-wrapper';

describe('AuthService', () => {
	let service: AuthService;
	let authWrapperService: jasmine.SpyObj<AuthWrapper>;
	let functionsWrapperService: jasmine.SpyObj<FunctionsWrapper>;
	let errorHandlerService: jasmine.SpyObj<ErrorHandlerService>;

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
					useValue: jasmine.createSpyObj<AuthWrapper>('AuthWrapper', [
						'authState',
						'sendPasswordResetEmail',
						'currentUser',
						'updatePassword',
						'signInWithEmailAndPassword',
						'signOut',
					]),
				},
				{
					provide: FunctionsWrapper,
					useValue: jasmine.createSpyObj<FunctionsWrapper>(
						'FunctionsWrapper',
						['updateEmailAddress']
					),
				},
				{
					provide: ErrorHandlerService,
					useValue: jasmine.createSpyObj<ErrorHandlerService>(
						'ErrorHandlerService',
						['handleError']
					),
				},
			],
		});

		authWrapperService = TestBed.inject(
			AuthWrapper
		) as jasmine.SpyObj<AuthWrapper>;
		functionsWrapperService = TestBed.inject(
			FunctionsWrapper
		) as jasmine.SpyObj<FunctionsWrapper>;
		errorHandlerService = TestBed.inject(
			ErrorHandlerService
		) as jasmine.SpyObj<ErrorHandlerService>;
	});

	beforeEach(() => {
		authStateSpy = authWrapperService.authState();
		authStateSpy.and.returnValue(of(mockUser));
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
		spyOn(mockUser, 'getIdTokenResult').and.resolveTo({
			claims: { admin: true },
		} as any);

		// Act
		const value = await firstValueFrom(service.isAdmin$);

		// Assert
		expect(value).toBeTrue();
	});

	it('isAdmin$: should return false', async () => {
		// Arrange
		spyOn(mockUser, 'getIdTokenResult').and.resolveTo({
			claims: {},
		} as any);

		// Act
		const value = await firstValueFrom(service.isAdmin$);

		// Assert
		expect(value).toBeFalse();
	});

	it('resetPassword(): should make expected call', async () => {
		// Arrange
		const spy = authWrapperService.sendPasswordResetEmail;
		spy.and.resolveTo();

		// Act
		await service.resetPassword('test@test.com');

		// Assert
		expect(spy).toHaveBeenCalledWith('test@test.com');
	});

	describe('changePassword()', () => {
		it('should make expected call', async () => {
			// Arrange
			const spy = authWrapperService.currentUser;
			spy.and.returnValue(null);

			// Act
			const action = service.changePassword('abc', 'def');

			// Assert
			await expectAsync(action).toBeRejectedWithError(
				'User cannot be null'
			);
		});

		it('should handle and return error', async () => {
			// Arrange
			authWrapperService.currentUser.and.returnValue(mockUser);

			const signInSpy = authWrapperService.signInWithEmailAndPassword;
			signInSpy.and.rejectWith(new Error());

			const errorHandlerSpy = errorHandlerService.handleError;
			errorHandlerSpy.and.resolveTo({});

			// Act
			const action = service.changePassword('abc', 'def');

			// Assert
			await expectAsync(action).toBeRejectedWithError();
			expect(errorHandlerSpy).toHaveBeenCalled();
		});

		it('should make expected calls', async () => {
			// Arrange
			authWrapperService.currentUser.and.returnValue(mockUser);

			const signInSpy = authWrapperService.signInWithEmailAndPassword;
			signInSpy.and.resolveTo({} as UserCredential);

			const updateSpy = authWrapperService.updatePassword;
			updateSpy.and.resolveTo();

			// Act
			await service.changePassword('currentPass', 'newPass');

			// Assert
			expect(signInSpy).toHaveBeenCalledWith(
				mockUser.email!,
				'currentPass'
			);
			expect(updateSpy).toHaveBeenCalledWith(mockUser, 'newPass');
		});

		describe('changeEmailAddress()', () => {
			it('should make expected call', async () => {
				// Arrange
				const spy = authWrapperService.currentUser;
				spy.and.returnValue(null);

				// Act
				const action = service.changeEmailAddress(
					'abc',
					'test2@test.com'
				);

				// Assert
				await expectAsync(action).toBeRejectedWithError(
					'User cannot be null'
				);
			});

			it('should handle and return error', async () => {
				// Arrange
				authWrapperService.currentUser.and.returnValue(mockUser);

				const signInSpy = authWrapperService.signInWithEmailAndPassword;
				signInSpy.and.rejectWith(new Error());

				const errorHandlerSpy = errorHandlerService.handleError;
				errorHandlerSpy.and.resolveTo({});

				// Act
				const action = service.changeEmailAddress(
					'abc',
					'test2@test.com'
				);

				// Assert
				await expectAsync(action).toBeRejectedWithError();
				expect(errorHandlerSpy).toHaveBeenCalled();
			});

			it('should make expected calls', async () => {
				// Arrange
				authWrapperService.currentUser.and.returnValue(mockUser);

				const signInSpy = authWrapperService.signInWithEmailAndPassword;
				signInSpy.and.resolveTo({} as UserCredential);

				const updateSpy = functionsWrapperService.updateEmailAddress;
				updateSpy.and.resolveTo();

				// Act
				await service.changeEmailAddress('password', 'test2@test.com');

				// Assert
				expect(signInSpy).toHaveBeenCalledWith(
					mockUser.email!,
					'password'
				);
				expect(updateSpy).toHaveBeenCalledWith('test2@test.com');
			});
		});
	});

	it('login(): should make expected call', async () => {
		// Arrange
		const signInSpy = authWrapperService.signInWithEmailAndPassword;
		signInSpy.and.resolveTo({} as UserCredential);

		// Act
		await service.login({ emailAddress: 'test@test.com', password: 'abc' });

		// Assert
		expect(signInSpy).toHaveBeenCalledWith(mockUser.email!, 'abc');
	});

	it('logout(): should make expected call', async () => {
		// Arrange
		const signInSpy = authWrapperService.signOut;
		signInSpy.and.resolveTo();

		// Act
		await service.logout(false);

		// Assert
		expect(signInSpy).toHaveBeenCalled();
	});
});
