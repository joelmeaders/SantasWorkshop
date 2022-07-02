import { IDateTimeSlot } from './date-time-slot.model';
import { IChild } from './child.model';

export interface IRegistration {
	uid?: string;
	qrcode?: string;
	firstName?: string;
	lastName?: string;
	emailAddress?: string;
	programYear?: number;
	children?: IChild[];

	// Date/Time slot chosen by the user
	dateTimeSlot?: Partial<IDateTimeSlot>;

	// Due to how slot capacity is calculated, this value
	// holds the slot the person cancelled until another
	// scheduled function consumes and removes it.
	previousDateTimeSlot?: Partial<IDateTimeSlot>;

	// Date/Time registration submitted
	registrationSubmittedOn?: Date;

	// This value is false until a scheduled function updates
	// slot counts with this record.
	includedInCounts?: false | Date;

	// This value is false until a scheduled function updates
	// registration with this record.
	includedInRegistrationStats?: false | Date;

	zipCode?: number;

	bhp?: number;
}
