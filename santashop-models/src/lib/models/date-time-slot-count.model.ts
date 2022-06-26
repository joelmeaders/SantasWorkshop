export interface IProgramYearCount {
  programYear: IDateTimeSlotCount;
}

export interface IDateTimeSlotCount {
  id: string;
  totalSlots: number;
  slotsReserved: number;
}

export interface IUsersInSlot {
  id: string;
  users: string[];
}
