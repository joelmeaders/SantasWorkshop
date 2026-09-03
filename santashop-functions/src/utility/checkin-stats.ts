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

	const { day, hour } = getLocalDayAndHour(checkIn.checkInDateTime);
	const dateTimeCount = (current?.dateTimeCount ?? []).map((entry) => ({
		...entry,
	}));
	const existing = dateTimeCount.find(
		(entry) => entry.date === day && entry.hour === hour,
	);

	if (existing) {
		existing.customerCount += 1;
		existing.childCount += checkIn.stats.children;
		if (checkIn.registrationCode !== 'onsite') {
			existing.pregisteredCount += 1;
		}
		if (checkIn.stats.modifiedAtCheckIn) {
			existing.modifiedCount += 1;
		}
	} else {
		dateTimeCount.push(createDateTimeCount(checkIn, day, hour));
	}

	return {
		lastUpdated: now,
		dateTimeCount,
	};
};

const createDateTimeCount = (
	checkIn: CheckIn,
	day: number,
	hour: number,
): CheckInDateTimeCount => ({
	date: day,
	hour,
	customerCount: 1,
	childCount: checkIn.stats?.children ?? 0,
	pregisteredCount: checkIn.registrationCode !== 'onsite' ? 1 : 0,
	modifiedCount: checkIn.stats?.modifiedAtCheckIn ? 1 : 0,
});

const getLocalDayAndHour = (date: Date): { day: number; hour: number } => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: SHOP_TIME_ZONE,
		day: 'numeric',
		hour: 'numeric',
		hourCycle: 'h23',
	}).formatToParts(date);
	const day = Number(parts.find((part) => part.type === 'day')?.value);
	const hour = Number(parts.find((part) => part.type === 'hour')?.value);

	if (!Number.isInteger(day) || !Number.isInteger(hour)) {
		throw new Error('Could not determine the local check-in time.');
	}

	return { day, hour };
};
