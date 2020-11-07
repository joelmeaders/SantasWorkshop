import { BaseEntity } from '@app/core/models/base/base-entity';

export class UserProfile extends BaseEntity {
  firstName: string;
  lastName: string;
  emailAddress: string;
  zipCode: string;
  registeredOn: Date;
  acceptedTermsOfService: Date;
  acceptedPrivacyPolicy: Date;
  analyticsDisabled?: number;
}