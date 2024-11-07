// import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
//
// import { firstValueFrom, of } from 'rxjs';
// import { PreRegistrationService } from '../../../../core';

// import { HelpPage } from './help.page';

// describe('HelpPage', () => {
//   let component: HelpPage;
//   let fixture: ComponentFixture<HelpPage>;
//   let viewService: jasmine.SpyObj<PreRegistrationService>;

//   beforeEach(waitForAsync(() => {
//     TestBed.configureTestingModule({
//       declarations: [ HelpPage ],
//       providers: [
//         {
//           provide: PreRegistrationService,
//           useValue: jasmine.createSpyObj<PreRegistrationService>('PreRegistrationService', {}, ['registrationComplete$'])
//         }
//       ],
//       imports: []
//     }).compileComponents();

//     fixture = TestBed.createComponent(HelpPage);
//     viewService = TestBed.inject(PreRegistrationService) as jasmine.SpyObj<PreRegistrationService>;
//     component = fixture.componentInstance;
//     fixture.detectChanges();
//   }));

//   it('should create', () => {
//     expect(component).toBeTruthy();
//   });

//   it('should resolve true', async () => {
//     // Arrange
//     const spy: any = Object.getOwnPropertyDescriptor(viewService, 'registrationComplete$')?.get;
//     spy.and.return(of(true));

//     // Act
//     const value = await firstValueFrom(component.isRegistrationComplete$);

//     // Assert
//     expect(value).toBeTrue();
//     expect(spy).toHaveBeenCalled();
//   });
// });
