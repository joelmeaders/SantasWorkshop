import { Timestamp } from "@firebase/firestore";

export function dateToTimestamp(date: Date = new Date()): Timestamp {
  return Timestamp.fromDate(date);
}

export function yyyymmddToLocalDate(isoString: string) {
  const [year, month, day] = isoString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getAgeFromDate(birthday: Date, fromDate: Date) {
  let today = fromDate;
  let thisYear = 0;

  const monthCheck = today.getMonth() < birthday.getMonth();
  const noTimeForThis = (today.getMonth() == birthday.getMonth()) && today.getDate() < birthday.getDate();
  
  if (monthCheck || noTimeForThis)
      thisYear = 1;

  return today.getFullYear() - birthday.getFullYear() - thisYear;
}