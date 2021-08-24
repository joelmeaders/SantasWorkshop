import firebase from 'firebase';

export interface IDateTimeSlot {
    id?: string;

    // Year of event
    programYear: number;

    dateTime: firebase.firestore.Timestamp;

    // Max number of slots
    maxSlots: number;

    // Enabled
    enabled: boolean;
}
