export interface IRegistrationStats {
  completedRegistrations: number;

  dateTimeCount: IDateTimeCount[];

  zipCodeCount: IZipCodeCount[];
}

export interface IDateTimeCount {
  dateTime: Date;
  count: number;
  childCount: number;
  stats: IGenderAgeStats;
}

export interface IZipCodeCount {
  zip: number;
  count: number;
  childCount: number;
}

export interface IGenderAgeStats {
  infants: IAgeGroupBreakdown;
  girls: IAgeGroupBreakdown;
  boys: IAgeGroupBreakdown;
}

export interface IAgeGroupBreakdown {
  total: number;
  age02: number;
  age35: number;
  age68: number;
  age911: number;
}

export interface IGenderAgeStatsDisplay {
  date: Date;
  stats: IGenderAgeStats;
}
