import { TestBed } from '@angular/core/testing';

import { ChildValidationService } from './child-validation.service';

describe('ChildValidationService', () => {
  let service: ChildValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChildValidationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
