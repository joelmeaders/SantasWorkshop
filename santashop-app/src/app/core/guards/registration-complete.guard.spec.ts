// import { TestBed } from '@angular/core/testing';
// import { Router } from '@angular/router';
// import { firstValueFrom, of } from 'rxjs';
// import { PreRegistrationService } from '../services/pre-registration.service';
// import { RegistrationCompleteGuard } from './registration-complete.guard';

// describe('RegistrationCompleteGuard', () => {
//   let guard: RegistrationCompleteGuard;
//   let preregistrationService: jasmine.SpyObj<PreRegistrationService>;

//   beforeEach(() => {
//     TestBed.configureTestingModule({ 
//       teardown: { destroyAfterEach: false },
//       providers: [
//         { provide: Router },
//         { provide: PreRegistrationService, useValue: jasmine.createSpyObj<PreRegistrationService>('prs', {}, ['registrationComplete$']) }
//       ]
//     });
//     guard = TestBed.inject(RegistrationCompleteGuard);
//     preregistrationService = TestBed.inject(PreRegistrationService) as jasmine.SpyObj<PreRegistrationService>;
//   });

//   it('should be created', () => {
//     expect(guard).toBeTruthy();
//   });

//   it('should return true', async () => {
//     // Arrange
//     const spy = Object.getOwnPropertyDescriptor(
//       preregistrationService,
//       'registrationComplete$'
//     )?.get as jasmine.Spy;

//     spy.and.returnValue(of(false));

//     // Act
//     const value = firstValueFrom(guard.canActivate());

//     // Assert
//     await expectAsync(value).toBeResolvedTo(true);
//     expect(spy).toHaveBeenCalled();
//   });
// });
