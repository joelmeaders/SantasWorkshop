import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { CheckInPage } from './check-in.page';

describe('CheckInPage', () => {
  let component: CheckInPage;
  let fixture: ComponentFixture<CheckInPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CheckInPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(CheckInPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
