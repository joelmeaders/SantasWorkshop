export interface ProgramYearCount {
	programYear: DateTimeSlotCount;
}

export interface DateTimeSlotCount {
	id: string;
	totalSlots: number;
	slotsReserved: number;
}

export interface UsersInSlot {
	id: string;
	users: string[];
}
