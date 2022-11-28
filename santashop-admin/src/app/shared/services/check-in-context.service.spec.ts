import { TestBed } from '@angular/core/testing';

import { CheckInContextService } from './check-in-context.service';

describe('CheckInContextService', () => {
  let service: CheckInContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CheckInContextService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
