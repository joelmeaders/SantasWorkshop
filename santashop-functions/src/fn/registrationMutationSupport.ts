import { HttpsError } from 'firebase-functions/v2/https';
import type { Child, DateTimeSlot, PublicParameters, Registration } from '../models';
import { AgeGroup, ToyType } from '../models';
import { PROGRAM_YEAR } from '../utility/runtime-config';

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

const requireBirthDate = (value: unknown): Date => {
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
	if (!date || Number.isNaN(date.valueOf())) {
		throw new HttpsError('invalid-argument', 'Date of birth must be a valid date.');
	}

	const currentYear = new Date().getFullYear();
	const earliest = new Date(currentYear - 13, 10, 15);
	const latest = new Date(currentYear, 11, 31);
	if (date < earliest || date > latest) {
		throw new HttpsError('invalid-argument', 'Child is not within the eligible age range.');
	}

	return date;
};

const ageGroupFor = (birthDate: Date): AgeGroup => {
	const asOf = new Date(new Date().getFullYear(), 11, 31);
	let age = asOf.getFullYear() - birthDate.getFullYear();
	if (
		asOf.getMonth() < birthDate.getMonth() ||
		(asOf.getMonth() === birthDate.getMonth() && asOf.getDate() < birthDate.getDate())
	) {
		age -= 1;
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
): DateTimeSlot => {
	if (!slot) {
		throw new HttpsError('not-found', 'The selected appointment no longer exists.');
	}
	if (slot.programYear !== PROGRAM_YEAR || !slot.enabled) {
		throw new HttpsError(
			'failed-precondition',
			'The selected appointment is no longer available.',
		);
	}
	if (!slot.dateTime) {
		throw new HttpsError('failed-precondition', 'The selected appointment is invalid.');
	}

	return { id: slot.id ?? slotId, dateTime: slot.dateTime, programYear: slot.programYear, maxSlots: slot.maxSlots, enabled: slot.enabled };
};
