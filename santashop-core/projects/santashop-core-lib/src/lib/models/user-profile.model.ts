import { BaseEntity } from './base-entity';

export class UserProfile extends BaseEntity {
  firstName: string | undefined;
  lastName: string | undefined;
  emailAddress: string | undefined;
  zipCode: string | undefined;
  acceptedTermsOfService: Date = new Date();
  acceptedPrivacyPolicy: Date = new Date();
  analyticsDisabled?: number;
}