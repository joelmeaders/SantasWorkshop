// import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
// import { TestBed } from '@angular/core/testing';

// import { Platform } from '@ionic/angular';

// import { AppComponent } from './app.component';

// describe('AppComponent', () => {

//   let platformSpy: jasmine.SpyObj<Platform>;
//   let platformReadySpy: jasmine.Spy

//   beforeEach(() => {
//     platformSpy = jasmine.createSpyObj('Platform', { ready: platformReadySpy });

//     platformReadySpy = jasmine.createSpy();
//     platformReadySpy.and.resolveTo();

//     TestBed.configureTestingModule({
//       declarations: [AppComponent],
//       schemas: [CUSTOM_ELEMENTS_SCHEMA],
//       providers: [
//         { provide: Platform, useValue: platformSpy },
//       ],
//     }).compileComponents();
//   });

//   it('should create the app', () => {
//     const fixture = TestBed.createComponent(AppComponent);
//     const app = fixture.debugElement.componentInstance;
//     expect(app).toBeTruthy();
//   });

//   it('should initialize the app', async () => {
//     TestBed.createComponent(AppComponent);
//     expect(platformSpy.ready).toHaveBeenCalled();
//     await platformReadySpy;
//   });

//   // TODO: add more tests!

// });
