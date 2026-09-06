import type {
	CheckIn,
	CheckInAggregatedStats,
	CheckInDateTimeCount,
} from '../models';
import { SHOP_TIME_ZONE } from './runtime-config';

export const addCheckInToAggregatedStats = (
	current: CheckInAggregatedStats | undefined,
	checkIn: CheckIn,
	now = new Date(),
): CheckInAggregatedStats => {
	if (!checkIn.checkInDateTime || !checkIn.stats) {
		throw new Error('Cannot aggregate an incomplete check-in record.');
	}

	const { dateKey, month, day, hour } = getLocalDateParts(
		checkIn.checkInDateTime,
	);
	const dateTimeCount = (current?.dateTimeCount ?? []).map((entry) => ({
		...entry,
	}));
	const existing = dateTimeCount.find((entry) => {
		if (entry.hour !== hour) return false;
		if (entry.dateKey) return entry.dateKey === dateKey;
		return month === 12 && entry.date === day;
	});

	if (existing) {
		existing.dateKey = dateKey;
		existing.customerCount += 1;
		existing.childCount += checkIn.stats.children;
		if (checkIn.registrationCode !== 'onsite') {
			existing.pregisteredCount += 1;
		}
		if (checkIn.stats.modifiedAtCheckIn) {
			existing.modifiedCount += 1;
		}
	} else {
		dateTimeCount.push(createDateTimeCount(checkIn, dateKey, day, hour));
	}

	return {
		lastUpdated: now,
		dateTimeCount,
	};
};

const createDateTimeCount = (
	checkIn: CheckIn,
	dateKey: string,
	day: number,
	hour: number,
): CheckInDateTimeCount => ({
	dateKey,
	date: day,
	hour,
	customerCount: 1,
	childCount: checkIn.stats?.children ?? 0,
	pregisteredCount: checkIn.registrationCode !== 'onsite' ? 1 : 0,
	modifiedCount: checkIn.stats?.modifiedAtCheckIn ? 1 : 0,
});

const getLocalDateParts = (
	date: Date,
): {
	dateKey: string;
	month: number;
	day: number;
	hour: number;
} => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: SHOP_TIME_ZONE,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		hourCycle: 'h23',
	}).formatToParts(date);
	const read = (type: Intl.DateTimeFormatPartTypes): number =>
		Number(parts.find((part) => part.type === type)?.value);
	const year = read('year');
	const month = read('month');
	const day = read('day');
	const hour = read('hour');

	if (
		!Number.isInteger(year) ||
		!Number.isInteger(month) ||
		!Number.isInteger(day) ||
		!Number.isInteger(hour)
	) {
		throw new Error('Could not determine the local check-in time.');
	}

	const dateKey = `${year.toString().padStart(4, '0')}-${month
		.toString()
		.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
	return { dateKey, month, day, hour };
};
