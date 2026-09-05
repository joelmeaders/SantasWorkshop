/** Reservation counts from the appointment-counter job for each schedule slot. */
export interface ScheduleStats {
	dateTimeCounts: {
		dateTime: Date;
		count: number;
	}[];
}
