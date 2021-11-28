export interface IRegistrationStats {
  completedRegistrations: number;

  dateTimeCount: IDateTimeCount[];

  zipCodeCount: IZipCodeCount[];
}

export interface IDateTimeCount {
  dateTime: Date;
  count: number;
  childCount: number;
}

export interface IZipCodeCount {
  zip: number;
  count: number;
  childCount: number;
}
