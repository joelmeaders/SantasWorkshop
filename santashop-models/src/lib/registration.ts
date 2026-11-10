import type { CustomerLanguage } from './language';
import { Child } from './child';
import { DateTimeSlot } from './date-time-slot';
import type { WaitingListMembership } from './waiting-list';

export interface Registration {
	waitingList?: WaitingListMembership;
	preferredLanguage?: CustomerLanguage;
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

	// Legacy delivery fields track confirmations. They do not prove an event reminder was sent.
	reminderEmailQueuedOn?: false | Date;

	reminderEmailFailedOn?: false | Date;

	reminderEmailSentOn?: false | Date;

	eventReminderQueuedOn?: false | Date;
	eventReminderSentOn?: false | Date;
	eventReminderFailedOn?: false | Date;

	qrCodeGeneratedOn?: false | Date;

	qrCodeGenerationFailedOn?: false | Date;

	hasCheckedIn?: boolean;

	// Set by the authoritative cancellation callable. A cancelled registration
	// returns to draft state and receives a new confirmation code.
	cancelledOn?: Date;
	cancelledByUid?: string;
	cancellationLogId?: string;
}

export interface OnSiteRegistrationRequest extends Registration {
	mutationId: string;
}

export interface ResendRegistrationEmailRequest {
	// Staff may resolve the customer from a known recovery queue ID.
	customerId?: string;
	recoverQueueId?: string;
	acknowledgeUncertainDelivery?: boolean;
}
