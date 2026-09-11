/** Reservation counts from the appointment-counter job for each schedule slot. */
export interface ScheduleStats {
	schemaVersion?: number;
	calculatedAt?: Date;
	programYear?: number;
	dateTimeCounts: {
		dateTime: Date;
		count: number;
	}[];
}
