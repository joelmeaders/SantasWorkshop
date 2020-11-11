import { BaseEntity } from '@app/core/models/base/base-entity';

// Need to keep this as lightweight as possible to prevent
// overly complex QR codes
export class Registration extends BaseEntity {
  // id is parent id
  code?: string;                // Unique Code
  fullName?: string;                 // Parent name,
  firstName?: string;
  lastName?: string;
  email?: string;               // Email Address
  children?: IChildrenInfo[];    // Children info
  date: string;                 // Arrival Date: DD
  time: string;                 // Arrival Time
  formattedDate: string;
  formattedTime: string;
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
  formattedDate: string;
  formattedTime: string;
}