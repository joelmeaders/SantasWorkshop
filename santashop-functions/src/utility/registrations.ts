import { AgeGroup, CheckInStats, Registration, ToyType } from '../models';

const hasValue = (value: unknown): boolean => {
	return value !== undefined && value !== null && value !== '';
};

export const isRegistrationComplete = (registration: Registration): boolean => {
	return Boolean(
		registration &&
		hasValue(registration.uid) &&
		hasValue(registration.emailAddress) &&
		hasValue(registration.firstName) &&
		hasValue(registration.lastName) &&
		hasValue(registration.qrcode) &&
		hasValue(registration.dateTimeSlot?.id) &&
		registration.children?.length &&
		hasValue(registration.zipCode),
	);
};

export const isPartialRegistrationComplete = (
	registration: Partial<Registration>,
): boolean => {
	return Boolean(
		registration &&
		hasValue(registration.uid) &&
		hasValue(registration.qrcode) &&
		hasValue(registration.zipCode) &&
		registration.children?.length,
	);
};

export const calculateRegistrationStats = (
	registration: Registration,
	isEdit: boolean,
): CheckInStats => {
	const children = registration.children ?? [];
	const zipCode = registration.zipCode ?? '';

	const stats: CheckInStats = {
		preregistered: registration.qrcode !== 'onsite',
		children: children.length,
		ageGroup02: children.filter((c) => c.ageGroup === AgeGroup.age02)
			.length,
		ageGroup35: children.filter((c) => c.ageGroup === AgeGroup.age35)
			.length,
		ageGroup68: children.filter((c) => c.ageGroup === AgeGroup.age68)
			.length,
		ageGroup911: children.filter((c) => c.ageGroup === AgeGroup.age911)
			.length,
		toyTypeInfant: children.filter((c) => c.toyType === ToyType.infant)
			.length,
		toyTypeBoy: children.filter((c) => c.toyType === ToyType.boy).length,
		toyTypeGirl: children.filter((c) => c.toyType === ToyType.girl).length,
		modifiedAtCheckIn: isEdit,
		zipCode,
	};
	return stats;
};
