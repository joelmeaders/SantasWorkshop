import { TestBed } from '@angular/core/testing';
import { Functions } from '@angular/fire/functions';
import { ErrorHandlerService } from '@core/*';
import { User, UserCredential } from 'firebase/auth';
import { firstValueFrom, of } from 'rxjs';
import { AfAuthService } from './af-auth.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let afAuthService: jasmine.SpyObj<AfAuthService>;
  let errorHandlerService: jasmine.SpyObj<ErrorHandlerService>;

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
          provide: AfAuthService,
          useValue: jasmine.createSpyObj<AfAuthService>(
            'AfAuthService',
            [
              'sendPasswordResetEmail',
              'currentUser',
              'updateUserPassword',
              'signInWithEmailAndPassword',
              'updateUserEmailAddress',
              'signOut',
            ],
            { authState$: of(mockUser) }
          ),
        },
        { provide: Functions, useValue: jasmine.createSpy('functions') },
        {
          provide: ErrorHandlerService,
          useValue: jasmine.createSpyObj<ErrorHandlerService>(
            'ErrorHandlerService',
            ['handleError']
          ),
        },
      ],
    });

    service = TestBed.inject(AuthService);
    afAuthService = TestBed.inject(
      AfAuthService
    ) as jasmine.SpyObj<AfAuthService>;
    errorHandlerService = TestBed.inject(
      ErrorHandlerService
    ) as jasmine.SpyObj<ErrorHandlerService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('currentUser$: should make expected calls', async () => {
    // Arrange
    const spy = Object.getOwnPropertyDescriptor(
      afAuthService,
      'authState$'
    )?.get;

    // Act
    await firstValueFrom(service.currentUser$);

    // Assert
    expect(spy).toHaveBeenCalledTimes(1);
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
    spyOn(mockUser, 'getIdTokenResult').and.resolveTo({ claims: {} } as any);

    // Act
    const value = await firstValueFrom(service.isAdmin$);

    // Assert
    expect(value).toBeFalse();
  });

  it('resetPassword(): should make expected call', async () => {
    // Arrange
    const spy = afAuthService.sendPasswordResetEmail;
    spy.and.resolveTo();

    // Act
    await service.resetPassword('test@test.com');

    // Assert
    expect(spy).toHaveBeenCalledWith('test@test.com');
  });

  describe('changePassword()', () => {
    it('should make expected call', async () => {
      // Arrange
      const spy = afAuthService.currentUser;
      spy.and.returnValue(null);

      // Act
      const action = service.changePassword('abc', 'def');

      // Assert
      await expectAsync(action).toBeRejectedWithError('User cannot be null');
    });

    it('should handle and return error', async () => {
      // Arrange
      afAuthService.currentUser.and.returnValue(mockUser);

      const signInSpy = afAuthService.signInWithEmailAndPassword;
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
      afAuthService.currentUser.and.returnValue(mockUser);

      const signInSpy = afAuthService.signInWithEmailAndPassword;
      signInSpy.and.resolveTo({} as UserCredential);

      const updateSpy = afAuthService.updateUserPassword;
      updateSpy.and.resolveTo();

      // Act
      await service.changePassword('currentPass', 'newPass');

      // Assert
      expect(signInSpy).toHaveBeenCalledWith(mockUser.email!, 'currentPass');
      expect(updateSpy).toHaveBeenCalledWith(mockUser, 'newPass');
    });

    describe('changeEmailAddress()', () => {
      it('should make expected call', async () => {
        // Arrange
        const spy = afAuthService.currentUser;
        spy.and.returnValue(null);

        // Act
        const action = service.changeEmailAddress('abc', 'test2@test.com');

        // Assert
        await expectAsync(action).toBeRejectedWithError('User cannot be null');
      });

      it('should handle and return error', async () => {
        // Arrange
        afAuthService.currentUser.and.returnValue(mockUser);

        const signInSpy = afAuthService.signInWithEmailAndPassword;
        signInSpy.and.rejectWith(new Error());

        const errorHandlerSpy = errorHandlerService.handleError;
        errorHandlerSpy.and.resolveTo({});

        // Act
        const action = service.changeEmailAddress('abc', 'test2@test.com');

        // Assert
        await expectAsync(action).toBeRejectedWithError();
        expect(errorHandlerSpy).toHaveBeenCalled();
      });

      it('should make expected calls', async () => {
        // Arrange
        afAuthService.currentUser.and.returnValue(mockUser);

        const signInSpy = afAuthService.signInWithEmailAndPassword;
        signInSpy.and.resolveTo({} as UserCredential);

        const updateSpy = afAuthService.updateUserEmailAddress;
        updateSpy.and.resolveTo();

        // Act
        await service.changeEmailAddress('password', 'test2@test.com');

        // Assert
        expect(signInSpy).toHaveBeenCalledWith(mockUser.email!, 'password');
        expect(updateSpy).toHaveBeenCalledWith('test2@test.com');
      });
    });
  });

  it('login(): should make expected call', async () => {
    // Arrange
    const signInSpy = afAuthService.signInWithEmailAndPassword;
    signInSpy.and.resolveTo({} as UserCredential);

    // Act
    await service.login({ emailAddress: 'test@test.com', password: 'abc' });

    // Assert
    expect(signInSpy).toHaveBeenCalledWith(mockUser.email!, 'abc');
  });

  it('logout(): should make expected call', async () => {
    // Arrange
    const signInSpy = afAuthService.signOut;
    signInSpy.and.resolveTo();

    // Act
    await service.logout(false);

    // Assert
    expect(signInSpy).toHaveBeenCalled();
  });
});
