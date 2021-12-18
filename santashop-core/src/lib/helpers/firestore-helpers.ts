import { Timestamp } from '@firebase/firestore';

/**
 * Convert Timestamp (pretending to be a date) to Date
 * 
 * @remarks
 * AngularFire or Firestore casts dates as timestamps
 * once stored. The property type may say Date (because
 * of the interface) but it's a Timestamp.
 * 
 * @export
 * @param {Date} timestampAsDate
 * @return {*}  {Date}
 */
export function timestampToDate(timestampAsDate: Date): Date {
  try {
    return (<any>timestampAsDate as Timestamp).toDate();
  }
  catch {
    return timestampAsDate;
  }
}