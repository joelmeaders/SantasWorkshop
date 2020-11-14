import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { QuickRegistrationPage } from './quick-registration.page';

describe('QuickRegistrationPage', () => {
  let component: QuickRegistrationPage;
  let fixture: ComponentFixture<QuickRegistrationPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ QuickRegistrationPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(QuickRegistrationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
