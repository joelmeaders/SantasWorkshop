import { IRegistration } from '../../../santashop-core/src';

export const isRegistrationComplete = (registration: IRegistration): boolean => {
  if (!registration) return false;
  if (!registration.emailAddress) return false;
  if (!registration.firstName) return false;
  if (!registration.lastName) return false;
  if (!registration.qrcode) return false;
  if (!registration.dateTimeSlot || !registration.dateTimeSlot.id) return false;
  if (!registration.children || registration.children.length === 0) return false;
  if (!registration.zipCode) return false;
  if (!registration.children || !registration.children.length) return false;
  return true;
};