import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ControlErrorsComponent } from './control-errors.component';

describe('ControlErrorsComponent', () => {
  let component: ControlErrorsComponent;
  let fixture: ComponentFixture<ControlErrorsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
    declarations: [ControlErrorsComponent],
    imports: [IonicModule.forRoot()],
    teardown: { destroyAfterEach: false }
}).compileComponents();

    fixture = TestBed.createComponent(ControlErrorsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
