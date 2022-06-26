import { Timestamp } from '@firebase/firestore';

export const dateToTimestamp = (date: Date = new Date()): Timestamp => {
  return Timestamp.fromDate(date);
};

export const yyyymmddToLocalDate = (isoString: string) => {
  const [year, month, day] = isoString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const getAgeFromDate = (birthday: Date, fromDate: Date) => {
  const today = fromDate;
  let thisYear = 0;

  const monthCheck = today.getMonth() < birthday.getMonth();
  const noTimeForThis =
    today.getMonth() === birthday.getMonth() &&
    today.getDate() < birthday.getDate();

  if (monthCheck || noTimeForThis) thisYear = 1;

  return today.getFullYear() - birthday.getFullYear() - thisYear;
};
