import { Timestamp } from 'firebase/firestore';

export const MAX_BIRTHDATE = (
	programYear = new Date().getFullYear(),
): Date => new Date(programYear, 11, 31);

export const MIN_BIRTHDATE = (
	programYear = new Date().getFullYear(),
): Date => new Date(programYear - 11, 0, 1);

export const dateToTimestamp = (date: Date = new Date()): Timestamp =>
	Timestamp.fromDate(date);

/**
 * Serialize a calendar date without changing its day for the user's timezone.
 * Firestore birth dates stored at exact UTC midnight retain their UTC day.
 */
export const dateToCalendarString = (date: Date): string => {
	if (Number.isNaN(date.getTime())) throw new RangeError('Invalid time value');

	const isUtcMidnight =
		date.getUTCHours() === 0 &&
		date.getUTCMinutes() === 0 &&
		date.getUTCSeconds() === 0 &&
		date.getUTCMilliseconds() === 0;
	const year = isUtcMidnight ? date.getUTCFullYear() : date.getFullYear();
	const month =
		(isUtcMidnight ? date.getUTCMonth() : date.getMonth()) + 1;
	const day = isUtcMidnight ? date.getUTCDate() : date.getDate();

	return `${year.toString().padStart(4, '0')}-${month
		.toString()
		.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

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

export const yyyymmddToLocalDate = (isoString: string): Date => {
	const [year, month, day] = isoString.split('-').map(Number);
	return new Date(year, month - 1, day);
};

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
