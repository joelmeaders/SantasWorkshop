import { IDateTimeSlot } from './date-time-slot.model';
import firebase from 'firebase';

export interface IRegistration {
  uid?: string;
  code?: string;                // Unique Code
  firstName?: string;
  lastName?: string;
  emailAddress?: string;               // Email Address
  children?: IChildrenInfo[];    // Children info
  programYear?: number;          // ie 2021
  dateTimeSlot?: Partial<IDateTimeSlot>;
  dateTimeRegistered?: firebase.firestore.Timestamp;
  zipCode?: number;
}

// Need to keep this as lightweight as possible to prevent
// overly complex QR codes
export interface IChildrenInfo {
  n?: string | undefined; // Name
  t: string | undefined; // Toy Type
  a: string | undefined; // Age Group
}

export interface IRegistrationDateTime {
  date: string | undefined;
  time: string | undefined;
  formattedDateTime: string | undefined;
}

export interface RegistrationSearchIndex {
  firstName: string | undefined;
  lastName: string | undefined;
  customerId: string | undefined;
  zip: string | undefined;
  code: string | undefined;
}
