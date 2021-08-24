import firebase from 'firebase';

export function dateToTimestamp(date: Date = new Date()): firebase.firestore.Timestamp {
  return firebase.firestore.Timestamp.fromDate(date);
}