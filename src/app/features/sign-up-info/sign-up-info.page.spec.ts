import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SignUpInfoPage } from './sign-up-info.page';

describe('SignUpInfoPage', () => {
  let component: SignUpInfoPage;
  let fixture: ComponentFixture<SignUpInfoPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SignUpInfoPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(SignUpInfoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
