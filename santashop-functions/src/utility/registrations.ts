import {
	AgeGroup,
	CheckInStats,
	Registration,
	ToyType,
} from '../../../santashop-models/src/public-api';

export const isRegistrationComplete = (registration: Registration): boolean => {
	if (!registration) return false;
	if (!registration.uid) return false;
	if (!registration.emailAddress) return false;
	if (!registration.firstName) return false;
	if (!registration.lastName) return false;
	if (!registration.qrcode) return false;
	if (!registration.dateTimeSlot || !registration.dateTimeSlot.id)
		return false;
	if (!registration.children || registration.children?.length === 0)
		return false;
	if (!registration.zipCode) return false;
	return true;
};

export const isPartialRegistrationComplete = (
	registration: Partial<Registration>
): boolean => {
	if (!registration) return false;
	if (!registration.uid) return false;
	if (!registration.qrcode) return false;
	if (!registration.zipCode) return false;
	if (!registration.children || !registration.children?.length) return false;
	return true;
};

export const calculateRegistrationStats = (
	registration: Registration,
	isEdit: boolean
): CheckInStats => {
	const stats: CheckInStats = {
		preregistered: (!!registration.qrcode && !!registration.uid) || false,
		children: registration.children?.length || 0,
		ageGroup02: registration.children!.filter(
			(c) => c.ageGroup === AgeGroup.age02
		).length,
		ageGroup35: registration.children!.filter(
			(c) => c.ageGroup === AgeGroup.age35
		).length,
		ageGroup68: registration.children!.filter(
			(c) => c.ageGroup === AgeGroup.age68
		).length,
		ageGroup911: registration.children!.filter(
			(c) => c.ageGroup === AgeGroup.age911
		).length,
		toyTypeInfant: registration.children!.filter(
			(c) => c.toyType === ToyType.infant
		).length,
		toyTypeBoy: registration.children!.filter(
			(c) => c.toyType === ToyType.boy
		).length,
		toyTypeGirl: registration.children!.filter(
			(c) => c.toyType === ToyType.girl
		).length,
		modifiedAtCheckIn: isEdit,
		zipCode: registration.zipCode!,
	};
	return stats;
};
