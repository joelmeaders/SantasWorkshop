import { Timestamp } from "firebase/firestore";

export function dateToTimestamp(date: Date = new Date()): Timestamp {
  return Timestamp.fromDate(date);
}