import { TestBed } from '@angular/core/testing';

import { CheckedInGuard } from './checked-in.guard';

describe('CheckedInGuard', () => {
  let guard: CheckedInGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(CheckedInGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
