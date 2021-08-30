import { IDateTimeSlot } from './date-time-slot.model';
import { Timestamp } from 'firebase/firestore'
import { IChild } from './child.model';

export interface IRegistration {
  uid?: string;
  code?: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  programYear?: number;
  dateTimeSlot?: Partial<IDateTimeSlot>;
  dateTimeRegistered?: Timestamp;
  includedInCounts?: false | Timestamp;
  zipCode?: number;
  children?: IChild[];
}