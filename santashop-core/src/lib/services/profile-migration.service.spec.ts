import { TestBed } from '@angular/core/testing';

import { ProfileMigrationService } from './profile-migration.service';

describe('ProfileMigrationService', () => {
  let service: ProfileMigrationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProfileMigrationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});