import { DateTimeSlot } from './date-time-slot';

/** Immutable operational record of a registration cancellation. */
export interface RegistrationCancellation {
	uid: string;
	actorUid: string;
	cancelledOn: Date;
	programYear: number;
	previousDateTimeSlot?: Partial<DateTimeSlot>;
	supersededConfirmationCode: string;
	supersededQrCodeStoragePath: string;
	replacementConfirmationCode: string;
	replacementQrCodeStoragePath: string;
}
