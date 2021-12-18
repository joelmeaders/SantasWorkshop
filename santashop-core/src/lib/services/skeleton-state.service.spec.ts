import { TestBed } from '@angular/core/testing';

import { SkeletonStateService } from './skeleton-state.service';

describe('SkeletonStateService', () => {
  let service: SkeletonStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SkeletonStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
