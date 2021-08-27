import { IDateTimeSlot } from './date-time-slot.model';
import { Timestamp } from 'firebase/firestore'

export interface IRegistration {
  uid?: string;
  code?: string;                // Unique Code
  firstName?: string;
  lastName?: string;
  emailAddress?: string;               // Email Address
  programYear?: number;          // ie 2021
  dateTimeSlot?: Partial<IDateTimeSlot>;
  dateTimeRegistered?: Timestamp;
  zipCode?: number;
}