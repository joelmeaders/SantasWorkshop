import { HttpsError } from 'firebase-functions/v2/https';
import type { Child, DateTimeSlot, PublicParameters, Registration } from '../models';
import { AgeGroup, ToyType } from '../models';
import {
	PROGRAM_YEAR,
	SHOP_TIME_ZONE,
} from '../utility/runtime-config';

export const MUTATION_RECEIPTS_SUBCOLLECTION = 'mutationReceipts';

export interface MutationReceipt {
	operation: string;
	result: true;
	completedOn: Date;
}

export const requireObject = (value: unknown): Record<string, unknown> => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new HttpsError('invalid-argument', 'Request data must be an object.');
	}

	return value as Record<string, unknown>;
};

export const requireOnlyKeys = (
	data: Record<string, unknown>,
	allowedKeys: readonly string[],
): void => {
	const unexpected = Object.keys(data).filter((key) => !allowedKeys.includes(key));
	if (unexpected.length) {
		throw new HttpsError('invalid-argument', 'Request contains unsupported fields.');
	}
};

export const requireMutationId = (value: unknown): string => {
	if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) {
		throw new HttpsError(
			'invalid-argument',
			'Mutation ID must contain 8-128 letters, numbers, underscores, or dashes.',
		);
	}

	return value;
};

export const requireOpenPreRegistration = (
	parameters: PublicParameters | undefined,
): void => {
	if (
		!parameters?.registrationEnabled ||
		parameters.maintenanceModeEnabled ||
		parameters.weatherModeEnabled ||
		!parameters.admin?.preRegistrationEnabled
	) {
		throw new HttpsError(
			'failed-precondition',
			'Pre-registration is currently unavailable.',
		);
	}
};

export const requireDraftRegistration = (
	registration: Registration | undefined,
): Registration => {
	if (!registration) {
		throw new HttpsError('not-found', 'Registration record was not found.');
	}
	if (registration.registrationSubmittedOn) {
		throw new HttpsError(
			'failed-precondition',
			'Submitted registrations cannot be edited.',
		);
	}

	return registration;
};

export const getStoredMutationResult = (
	receipt: MutationReceipt | undefined,
	operation: string,
): true | undefined => {
	if (!receipt) return undefined;
	if (receipt.operation !== operation) {
		throw new HttpsError(
			'already-exists',
			'This mutation ID was already used for a different operation.',
		);
	}
	return receipt.result;
};

const requireName = (value: unknown, label: string, maxLength: number): string => {
	if (typeof value !== 'string') {
		throw new HttpsError('invalid-argument', `${label} must be a string.`);
	}
	const normalized = value.trim();
	if (normalized.length < 2 || normalized.length > maxLength) {
		throw new HttpsError(
			'invalid-argument',
			`${label} must be between 2 and ${maxLength} characters.`,
		);
	}
	return normalized;
};

const requireChildId = (value: unknown): number => {
	if (!Number.isSafeInteger(value) || (value as number) < 0) {
		throw new HttpsError('invalid-argument', 'Child ID must be a non-negative integer.');
	}
	return value as number;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const eventDateFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: SHOP_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

const toUtcCalendarDate = (
	year: number,
	month: number,
	day: number,
): Date | undefined => {
	const date = new Date(0);
	date.setUTCFullYear(year, month - 1, day);
	date.setUTCHours(0, 0, 0, 0);
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		return undefined;
	}
	return date;
};

const toEventCalendarDate = (date: Date): Date | undefined => {
	const parts = eventDateFormatter.formatToParts(date);
	const year = Number(parts.find((part) => part.type === 'year')?.value);
	const month = Number(parts.find((part) => part.type === 'month')?.value);
	const day = Number(parts.find((part) => part.type === 'day')?.value);
	if (![year, month, day].every(Number.isInteger)) return undefined;
	return toUtcCalendarDate(year, month, day);
};

const isUtcMidnight = (date: Date): boolean =>
	date.getUTCHours() === 0 &&
	date.getUTCMinutes() === 0 &&
	date.getUTCSeconds() === 0 &&
	date.getUTCMilliseconds() === 0;

const requireBirthDate = (value: unknown): Date => {
	let normalizedDate: Date | undefined;
	const dateOnlyMatch =
		typeof value === 'string' ? DATE_ONLY_PATTERN.exec(value) : undefined;
	if (dateOnlyMatch) {
		normalizedDate = toUtcCalendarDate(
			Number(dateOnlyMatch[1]),
			Number(dateOnlyMatch[2]),
			Number(dateOnlyMatch[3]),
		);
		if (!normalizedDate) {
			throw new HttpsError(
				'invalid-argument',
				'Date of birth must be a valid date.',
			);
		}
	}

	if (!normalizedDate) {
		const timestampLike =
			typeof value === 'object' &&
			value !== null &&
			'toDate' in value &&
			typeof value.toDate === 'function';
		const date = value instanceof Date
			? value
			: typeof value === 'string'
				? new Date(value)
				: timestampLike
					? value.toDate()
					: undefined;
		if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
			throw new HttpsError('invalid-argument', 'Date of birth must be a valid date.');
		}
		normalizedDate = isUtcMidnight(date)
			? toUtcCalendarDate(
					date.getUTCFullYear(),
					date.getUTCMonth() + 1,
					date.getUTCDate(),
				)
			: toEventCalendarDate(date);
	}
	if (!normalizedDate) {
		throw new HttpsError('invalid-argument', 'Date of birth must be a valid date.');
	}

	const earliest = toUtcCalendarDate(PROGRAM_YEAR - 11, 1, 1);
	const latest = toUtcCalendarDate(PROGRAM_YEAR, 12, 31);
	if (!earliest || !latest || normalizedDate < earliest || normalizedDate > latest) {
		throw new HttpsError('invalid-argument', 'Child is not within the eligible age range.');
	}

	return normalizedDate;
};

const ageGroupFor = (birthDate: Date): AgeGroup => {
	const asOf = toUtcCalendarDate(PROGRAM_YEAR, 12, 31) as Date;
	let age = asOf.getUTCFullYear() - birthDate.getUTCFullYear();
	if (
		asOf.getUTCMonth() < birthDate.getUTCMonth() ||
		(asOf.getUTCMonth() === birthDate.getUTCMonth() &&
			asOf.getUTCDate() < birthDate.getUTCDate())
	) {
		age -= 1;
	}
	if (age < 0 || age >= 12) {
		throw new HttpsError('invalid-argument', 'Child is not within the eligible age range.');
	}
	if (age < 3) return AgeGroup.age02;
	if (age < 6) return AgeGroup.age35;
	if (age < 9) return AgeGroup.age68;
	return AgeGroup.age911;
};

const requireToyType = (value: unknown, ageGroup: AgeGroup): ToyType => {
	if (!Object.values(ToyType).includes(value as ToyType)) {
		throw new HttpsError('invalid-argument', 'Toy type is invalid.');
	}
	if (ageGroup === AgeGroup.age02 && value !== ToyType.infant) {
		throw new HttpsError('invalid-argument', 'Infant children must use the infant toy type.');
	}
	if (ageGroup !== AgeGroup.age02 && value === ToyType.infant) {
		throw new HttpsError('invalid-argument', 'The infant toy type is only available to infant children.');
	}
	return value as ToyType;
};

export const canonicalizeChild = (value: unknown): Child => {
	const data = requireObject(value);
	requireOnlyKeys(data, [
		'id',
		'firstName',
		'lastName',
		'dateOfBirth',
		'toyType',
	]);
	const dateOfBirth = requireBirthDate(data['dateOfBirth']);
	const ageGroup = ageGroupFor(dateOfBirth);

	return {
		id: requireChildId(data['id']),
		firstName: requireName(data['firstName'], 'First name', 20),
		lastName: requireName(data['lastName'], 'Last name', 25),
		dateOfBirth,
		ageGroup,
		toyType: requireToyType(data['toyType'], ageGroup),
		programYearAdded: PROGRAM_YEAR,
		enabled: true,
	};
};

export const requireCanonicalChildren = (children: Child[] | undefined): Child[] => {
	if (!children?.length) {
		throw new HttpsError('failed-precondition', 'At least one eligible child is required.');
	}

	return children.map((child) => canonicalizeChild({
		id: child.id,
		firstName: child.firstName,
		lastName: child.lastName,
		dateOfBirth: child.dateOfBirth,
		toyType: child.toyType,
	}));
};

export const requireEnabledCurrentSlot = (
	slot: DateTimeSlot | undefined,
	slotId: string,
	now: Date,
	customer = true,
): DateTimeSlot => {
	if (!slot) {
		throw new HttpsError(
			'not-found',
			'The selected appointment no longer exists.',
			{ reason: 'appointment-review-required' },
		);
	}
	if (
		slot.programYear !== PROGRAM_YEAR ||
		!slot.enabled ||
		!Number.isFinite(slot.maxSlots) ||
		(slot.slotsReserved ?? 0) >= slot.maxSlots
	) {
		throw new HttpsError(
			'failed-precondition',
			'The selected appointment is no longer available.',
			{ reason: 'appointment-review-required' },
		);
	}
	const dateTime = appointmentInstant(slot.dateTime);
	if (!Number.isFinite(dateTime) || (customer && dateTime <= now.valueOf())) {
		throw new HttpsError(
			'failed-precondition',
			'The selected appointment is no longer available.',
			{ reason: 'appointment-review-required' },
		);
	}

	return {
		id: slot.id ?? slotId,
		dateTime: slot.dateTime,
		programYear: slot.programYear,
		maxSlots: slot.maxSlots,
		enabled: slot.enabled,
	};
};

export const appointmentInstant = (value: unknown): number => {
	if (value instanceof Date) return value.valueOf();
	if (typeof value === 'string') return new Date(value).valueOf();
	if (
		typeof value === 'object' &&
		value !== null &&
		'toDate' in value &&
		typeof value.toDate === 'function'
	) {
		const date: unknown = value.toDate();
		return date instanceof Date ? date.valueOf() : NaN;
	}
	return NaN;
};

export const requireReviewedAppointment = (
	reviewed: unknown,
	current: unknown,
): void => {
	if (
		!Number.isFinite(appointmentInstant(reviewed)) ||
		appointmentInstant(reviewed) !== appointmentInstant(current)
	) {
		throw new HttpsError(
			'failed-precondition',
			'Please review the current appointment details.',
			{ reason: 'appointment-review-required' },
		);
	}
};
