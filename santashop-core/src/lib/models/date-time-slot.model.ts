import { Timestamp } from "firebase/firestore";

export interface IDateTimeSlot {
    id?: string;

    programYear: number;

    dateTime: Timestamp;

    maxSlots: number;

    slotsReserved?: number;

    enabled: boolean;

    lastUpdated?: Timestamp;
}
