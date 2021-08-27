import { Timestamp } from 'firebase/firestore'

export interface IDateTimeSlot {
    id?: string;

    // Year of event
    programYear: number;

    dateTime: Timestamp;

    // Max number of slots
    maxSlots: number;

    // Enabled
    enabled: boolean;
}
