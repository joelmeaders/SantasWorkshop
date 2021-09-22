import { IDateTimeSlot } from './date-time-slot.model';
import { IChild } from './child.model';

export interface IRegistration {
  uid?: string;
  code?: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  programYear?: number;
  children?: IChild[];
  dateTimeSlot?: Partial<IDateTimeSlot>;
  registrationSubmittedOn?: Date;
  includedInCounts?: false | Date;
  zipCode?: number;
}
