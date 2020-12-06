import firebase from 'firebase/app';

export interface ICheckInAggregatedStats {
  lastUpdated: firebase.firestore.Timestamp;
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
