export interface IUser {
  uid?: string;

  firstName: string;

  lastName: string;

  emailAddress: string;

  zipCode: number;

  acceptedTermsOfService?: Date;

  acceptedPrivacyPolicy?: Date;
}