export interface User {
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
