import { Registration } from '../../../santashop-models/src/lib/models';

export const isRegistrationComplete = (
	registration: Registration
): boolean => {
	if (!registration) return false;
	if (!registration.emailAddress) return false;
	if (!registration.firstName) return false;
	if (!registration.lastName) return false;
	if (!registration.qrcode) return false;
	if (!registration.dateTimeSlot || !registration.dateTimeSlot.id)
		return false;
	if (!registration.children || registration.children.length === 0)
		return false;
	if (!registration.zipCode) return false;
	if (!registration.children || !registration.children.length) return false;
	return true;
};
