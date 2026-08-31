import type { DateTimeSlot } from '@santashop/models';

export interface ScheduleGenerationRequest {
	programYear: number;
	dates: Date[];
	capacity: number;
	startHour: number;
	endHour: number;
	enabled?: boolean;
}

export const parseLocalDateInput = (value: string): Date => {
	const [year, month, day] = value.split('-').map(Number);

	if (!year || !month || !day) {
		throw new Error('Invalid date input. Expected yyyy-mm-dd.');
	}

	return new Date(year, month - 1, day);
};

export const buildDateRange = (startDate: Date, endDate: Date): Date[] => {
	const start = stripTime(startDate);
	const end = stripTime(endDate);

	if (start.valueOf() > end.valueOf()) {
		throw new Error('Start date must be on or before end date.');
	}

	const dates: Date[] = [];
	const current = new Date(start);

	while (current.valueOf() <= end.valueOf()) {
		dates.push(new Date(current));
		current.setDate(current.getDate() + 1);
	}

	return dates;
};

export const createHourlyScheduleSlots = (
	request: ScheduleGenerationRequest,
): DateTimeSlot[] => {
	validateRequest(request);

	const enabled = request.enabled ?? true;
	const uniqueDates = Array.from(
		new Set(request.dates.map((date) => stripTime(date).valueOf())),
	)
		.map((value) => new Date(value))
		.sort((left, right) => left.valueOf() - right.valueOf());

	return uniqueDates.flatMap((date) =>
		createSlotsForDate(
			date,
			request.programYear,
			request.capacity,
			request.startHour,
			request.endHour,
			enabled,
		),
	);
};

const createSlotsForDate = (
	date: Date,
	programYear: number,
	capacity: number,
	startHour: number,
	endHour: number,
	enabled: boolean,
): DateTimeSlot[] => {
	const slots: DateTimeSlot[] = [];

	for (let hour = startHour; hour <= endHour; hour += 1) {
		slots.push({
			programYear,
			dateTime: new Date(
				date.getFullYear(),
				date.getMonth(),
				date.getDate(),
				hour,
				0,
				0,
				0,
			),
			maxSlots: capacity,
			slotsReserved: 0,
			enabled,
		});
	}

	return slots;
};

const stripTime = (date: Date): Date =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate());

const validateRequest = (request: ScheduleGenerationRequest): void => {
	if (request.dates.length === 0) {
		throw new TypeError('At least one date is required.');
	}

	if (!Number.isInteger(request.programYear)) {
		throw new TypeError('Program year must be a whole number.');
	}

	if (!Number.isInteger(request.capacity) || request.capacity < 0) {
		throw new TypeError('Capacity must be zero or greater.');
	}

	if (!Number.isInteger(request.startHour) || request.startHour < 0) {
		throw new TypeError('Start hour must be between 0 and 23.');
	}

	if (!Number.isInteger(request.endHour) || request.endHour > 23) {
		throw new TypeError('End hour must be between 0 and 23.');
	}

	if (request.startHour > request.endHour) {
		throw new TypeError('Start hour must be before or equal to end hour.');
	}
};
