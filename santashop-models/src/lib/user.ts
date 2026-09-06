import type { CustomerLanguage } from './language';
export interface User {
	preferredLanguage?: CustomerLanguage;
	uid?: string;

	firstName: string;

	lastName: string;

	emailAddress: string;

	zipCode: string;

	acceptedTermsOfService?: Date;

	acceptedPrivacyPolicy?: Date;

	newsletter: boolean;

	referredBy?: string;
}
