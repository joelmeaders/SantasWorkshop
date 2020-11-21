import { BaseEntity } from './base-entity';

export class Registration extends BaseEntity {
  // id is parent id
  code?: string;                // Unique Code
  fullName?: string;                 // Parent name,
  firstName?: string;
  lastName?: string;
  email?: string;               // Email Address
  children?: IChildrenInfo[];    // Children info
  date: string | undefined;                 // Arrival Date: DD
  time: string | undefined;                 // Arrival Time
  formattedDateTime: string | undefined;
  dateTimeRegistered?: Date;
  zipCode: string;
}

// Need to keep this as lightweight as possible to prevent
// overly complex QR codes
export interface IChildrenInfo {
  n: string; // Name
  t: string; // Toy Type
  a: string; // Age Group
}

export interface IRegistrationDateTime {
  date: string;
  time: string;
  formattedDateTime: string;
}

export class RegistrationSearchIndex {
  firstName: string;
  lastName: string;
  customerId: string;
  zip: string;
  code: string;
}
