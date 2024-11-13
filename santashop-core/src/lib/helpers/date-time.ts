import { Timestamp } from '@firebase/firestore';

// TODO: Injectable tokens
export const MAX_BIRTHDATE = (): Date => new Date('12/31/2024');

export const MIN_BIRTHDATE = (): Date => new Date('11/15/2012');

export const dateToTimestamp = (date: Date = new Date()): Timestamp =>
	Timestamp.fromDate(date);

/**
 * Convert Timestamp (pretending to be a date) to Date
 *
 * @remarks
 * AngularFire or Firestore casts dates as timestamps
 * once stored. The property type may say Date (because
 * of the interface) but it's a Timestamp.
 *
 * @export
 * @param timestampAsDate
 * @return
 */
export const timestampToDate = (timestampAsDate: Date): Date => {
	try {
		return (timestampAsDate as any as Timestamp).toDate();
	} catch {
		return timestampAsDate;
	}
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
