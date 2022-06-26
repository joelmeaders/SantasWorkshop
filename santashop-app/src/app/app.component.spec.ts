import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Analytics } from '@angular/fire/analytics';

import { Platform } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

import { AppComponent } from './app.component';
import { AppStateService } from './core';

describe('AppComponent', () => {
  let platformSpy: jasmine.SpyObj<Platform>;
  let translateSpy: jasmine.SpyObj<TranslateService>;

  beforeEach(() => {
    platformSpy = jasmine.createSpyObj('Platform', {
      ready: Promise.resolve(),
    });
    translateSpy = jasmine.createSpyObj('Translate', [
      'addLangs',
      'setDefaultLang',
      'getBrowserLang',
      'use',
    ]);

    TestBed.configureTestingModule({
      declarations: [AppComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: Platform, useValue: platformSpy },
        { provide: TranslateService, useValue: translateSpy },
        { provide: AppStateService, useValue: jasmine.createSpy() },
        { provide: Analytics, useValue: jasmine.createSpy() },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should initialize the app', async () => {
    TestBed.createComponent(AppComponent);
    expect(platformSpy.ready).toHaveBeenCalled();
  });
});
