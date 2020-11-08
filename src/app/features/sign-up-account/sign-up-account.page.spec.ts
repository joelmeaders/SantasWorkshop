import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SignUpAccountPage } from './sign-up-account.page';

describe('SignUpAccountPage', () => {
  let component: SignUpAccountPage;
  let fixture: ComponentFixture<SignUpAccountPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SignUpAccountPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(SignUpAccountPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
