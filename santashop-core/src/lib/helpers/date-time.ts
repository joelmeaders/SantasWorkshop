import { Timestamp } from '@firebase/firestore';

export const dateToTimestamp = (date: Date = new Date()): Timestamp => {
	return Timestamp.fromDate(date);
};

// TODO: Siimplify
export const yyyymmddToLocalDate = (isoString: string): Date => {
	const [year, month, day] = isoString.split('-').map(Number);
	return new Date(year, month - 1, day);
};

// TODO: Siimplify
export const getAgeFromDate = (birthday: Date, fromDate: Date): number => {
	const today = fromDate;
	let thisYear = 0;

	const monthCheck = today.getMonth() < birthday.getMonth();
	const noTimeForThis =
		today.getMonth() === birthday.getMonth() &&
		today.getDate() < birthday.getDate();

	if (monthCheck || noTimeForThis) thisYear = 1;

	return today.getFullYear() - birthday.getFullYear() - thisYear;
};
