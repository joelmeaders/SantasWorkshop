import { Child } from './child';
import { DateTimeSlot } from './date-time-slot';

export interface Registration {
	uid?: string;
	qrcode?: string;
	qrCodeStoragePath: string;
	firstName?: string;
	lastName?: string;
	emailAddress?: string;
	programYear?: number;
	children?: Child[];
	// Added in 2023 and used by admin pre-registration
	newsletter?: boolean;

	// Date/Time slot chosen by the user
	dateTimeSlot?: Partial<DateTimeSlot>;

	// Due to how slot capacity is calculated, this value
	// holds the slot the person cancelled until another
	// scheduled function consumes and removes it.
	previousDateTimeSlot?: Partial<DateTimeSlot>;

	// Date/Time registration submitted
	registrationSubmittedOn?: Date;

	// This value is false until a scheduled function updates
	// slot counts with this record.
	includedInCounts?: false | Date;

	// This value is false until a scheduled function updates
	// registration with this record.
	includedInRegistrationStats?: false | Date;

	zipCode?: string;

	referredBy?: string;

	reminderEmailQueuedOn?: false | Date;

	reminderEmailFailedOn?: false | Date;

	reminderEmailSentOn?: false | Date;

	qrCodeGeneratedOn?: false | Date;

	qrCodeGenerationFailedOn?: false | Date;

	hasCheckedIn?: boolean;

	// Set by the authoritative cancellation callable. A cancelled registration
	// returns to draft state and receives a new confirmation code.
	cancelledOn?: Date;
	cancelledByUid?: string;
	cancellationLogId?: string;
}
