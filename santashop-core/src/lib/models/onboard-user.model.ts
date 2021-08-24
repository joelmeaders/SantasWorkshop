export interface IOnboardUser {
  firstName: string;
  lastName: string;
  emailAddress: string;
  password: string;
  password2: string;
  zipCode: number;
  legal: boolean | Date;
}