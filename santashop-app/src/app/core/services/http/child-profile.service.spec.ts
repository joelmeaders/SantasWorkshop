import { TestBed } from '@angular/core/testing';

import { ChildProfileService } from './child-profile.service';

describe('ChildProfileService', () => {
  let service: ChildProfileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChildProfileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
