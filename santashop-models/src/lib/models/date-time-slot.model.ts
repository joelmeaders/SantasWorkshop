export interface IDateTimeSlot {
	id?: string;

	programYear: number;

	dateTime: Date;

	maxSlots: number;

	slotsReserved?: number;

	enabled: boolean;

	lastUpdated?: Date;
}
