import { BaseEntity } from './base-entity';

export class ChildProfile extends BaseEntity {
  parentId: string | undefined;
  firstName: string | undefined;
  dateOfBirth: string | undefined;
  toyType: string | undefined;
  ageGroup: string | undefined;
}