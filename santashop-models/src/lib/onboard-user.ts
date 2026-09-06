import type { CustomerLanguage } from './language';
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
