import { DateTimeSlot } from './date-time-slot';

/** Immutable operational record of a registration cancellation. */
export interface RegistrationCancellation {
	uid: string;
	actorUid: string;
	cancelledOn: Date;
	previousDateTimeSlot?: Partial<DateTimeSlot>;
	supersededConfirmationCode?: string;
	replacementConfirmationCode: string;
}
