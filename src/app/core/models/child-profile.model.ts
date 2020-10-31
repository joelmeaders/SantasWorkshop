import { BaseEntity } from '@app/core/models/base/base-entity';

export class ChildProfile extends BaseEntity {
  parentId: string;
  firstName: string;
  dateOfBirth: string;
  toyType: string;
  ageGroup: string;
}