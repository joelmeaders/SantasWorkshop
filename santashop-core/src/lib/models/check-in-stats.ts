import { Timestamp } from 'firebase/firestore'

export interface ICheckInAggregatedStats {
  lastUpdated: Timestamp;
  dateTimeCount: ICheckInDateTimeCount[];
}

export interface ICheckInDateTimeCount {
  date: number;
  hour: number;
  customerCount: number;
  childCount: number;
  pregisteredCount: number;
  modifiedCount: number;
}
