import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { PreRegistrationService } from '../services/pre-registration.service';
import { RegistrationCompleteGuard } from './registration-complete.guard';

describe('RegistrationCompleteGuard', () => {
  let guard: RegistrationCompleteGuard;
  let preregistrationService: jasmine.SpyObj<PreRegistrationService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    TestBed.configureTestingModule({ 
      teardown: { destroyAfterEach: false },
      providers: [
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['parseUrl']) },
        { provide: PreRegistrationService, useValue: jasmine.createSpyObj<PreRegistrationService>('prs', {}, ['registrationComplete$']) }
      ]
    });
    guard = TestBed.inject(RegistrationCompleteGuard);
    preregistrationService = TestBed.inject(PreRegistrationService) as jasmine.SpyObj<PreRegistrationService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should return true', async () => {
    // Arrange
    const spy = Object.getOwnPropertyDescriptor(
      preregistrationService,
      'registrationComplete$'
    )?.get as jasmine.Spy;

    spy.and.returnValue(of(false));

    // Act
    const value = firstValueFrom(guard.canActivate());

    // Assert
    await expectAsync(value).toBeResolvedTo(true);
    expect(spy).toHaveBeenCalled();
  });

  it('should return urlTree', async () => {
    // Arrange
    const registrationSpy = Object.getOwnPropertyDescriptor(
      preregistrationService,
      'registrationComplete$'
    )?.get as jasmine.Spy;

    registrationSpy.and.returnValue(of(true));

    const routerSpy = router.parseUrl;
    routerSpy.and.returnValue(new UrlTree());

    // Act
    const value = await firstValueFrom(guard.canActivate());

    // Assert
    expect(value).toBeInstanceOf(UrlTree);
    expect(registrationSpy).toHaveBeenCalled();
    expect(routerSpy).toHaveBeenCalled();
  });
});
