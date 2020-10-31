import { TestBed } from '@angular/core/testing';

import { RouterParamService } from './router-param.service';

describe('RouterParamService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: RouterParamService = TestBed.get(RouterParamService);
    expect(service).toBeTruthy();
  });
});
