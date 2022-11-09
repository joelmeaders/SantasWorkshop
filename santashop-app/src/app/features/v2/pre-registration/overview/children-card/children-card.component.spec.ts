import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChildrenCardComponent } from './children-card.component';

describe('ChildrenCardComponent', () => {
  let component: ChildrenCardComponent;
  let fixture: ComponentFixture<ChildrenCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ChildrenCardComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChildrenCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
