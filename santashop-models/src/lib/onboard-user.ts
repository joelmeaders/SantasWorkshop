import type { CustomerLanguage } from './language';
/** Signup validates the exact password sent to Firebase Auth. */
export const SIGNUP_PASSWORD_MIN_LENGTH = 8;
export const SIGNUP_PASSWORD_MAX_LENGTH = 40;

export interface OnboardUser {
	preferredLanguage?: CustomerLanguage;
	firstName: string;
	lastName: string;
	emailAddress: string;
	password: string;
	password2: string;
	zipCode: string;
	referredBy: string;
	legal: boolean | Date;
	newsletter: boolean;
}

export interface ChangeUserInfo {
	firstName: string;
	lastName: string;
	zipCode: string;
}
