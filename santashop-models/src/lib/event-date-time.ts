export const EVENT_TIME_ZONE = 'America/Denver';

interface ZonedDateParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

export const getZonedDateParts = (
	date: Date,
	timeZone = EVENT_TIME_ZONE,
): ZonedDateParts => {
	let formatter = formatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23',
		});
		formatters.set(timeZone, formatter);
	}
	const parts = Object.fromEntries(
		formatter.formatToParts(date).map(({ type, value }) => [type, value]),
	);
	return {
		year: Number(parts['year']),
		month: Number(parts['month']),
		day: Number(parts['day']),
		hour: Number(parts['hour']),
		minute: Number(parts['minute']),
		second: Number(parts['second']),
	};
};

export const getZonedDateKey = (
	date: Date,
	timeZone = EVENT_TIME_ZONE,
): string => {
	const { year, month, day } = getZonedDateParts(date, timeZone);
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const offsetMinutes = (date: Date, timeZone: string): number => {
	const { year, month, day, hour, minute, second } = getZonedDateParts(
		date,
		timeZone,
	);
	return (
		(Date.UTC(year, month - 1, day, hour, minute, second) -
			Math.floor(date.getTime() / 1000) * 1000) /
		60_000
	);
};

/** Resolve the named zone at this instant for Angular's offset-based DatePipe. */
export const getDateTimezoneOffset = (
	date: Date,
	timeZone = EVENT_TIME_ZONE,
): string => {
	const minutes = offsetMinutes(date, timeZone);
	const absolute = Math.abs(minutes);
	return `${minutes < 0 ? '-' : '+'}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
};

/** Convert an event calendar date and wall-clock hour into an absolute instant. */
export const createZonedDate = (
	calendarDate: string,
	hour: number,
	timeZone = EVENT_TIME_ZONE,
): Date => {
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(calendarDate) ||
		!Number.isInteger(hour) ||
		hour < 0 ||
		hour > 23
	) {
		throw new RangeError(
			'Expected a yyyy-mm-dd calendar date and an hour from 0 to 23.',
		);
	}
	const [year, month, day] = calendarDate.split('-').map(Number);
	const wallClock = Date.UTC(year, month - 1, day, hour);
	const calendar = new Date(wallClock);
	if (
		calendar.getUTCFullYear() !== year ||
		calendar.getUTCMonth() !== month - 1 ||
		calendar.getUTCDate() !== day
	) {
		throw new RangeError('Invalid calendar date.');
	}
	let date = calendar;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const corrected = new Date(
			wallClock - offsetMinutes(date, timeZone) * 60_000,
		);
		if (corrected.getTime() === date.getTime()) return corrected;
		date = corrected;
	}
	// A daylight-saving gap has no corresponding instant. Do not shift the slot.
	throw new RangeError(
		`The selected hour does not exist in ${timeZone} on ${calendarDate}.`,
	);
};
