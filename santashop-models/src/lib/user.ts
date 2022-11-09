export interface User {
	uid?: string;

	firstName: string;

	lastName: string;

	emailAddress: string;

	zipCode: number;

	acceptedTermsOfService?: Date;

	acceptedPrivacyPolicy?: Date;

	// Profile version: Increment on field changes, add changes to
	// profile migration service in @core
	version: number;

	manuallyMigrated: boolean;

	newsletter: boolean;

	referredBy?: string;
}
