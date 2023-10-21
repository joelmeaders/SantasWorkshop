export interface OnboardUser {
	firstName: string;
	lastName: string;
	emailAddress: string;
	password: string;
	password2: string;
	zipCode: string;
	legal: boolean | Date;
	newsletter: boolean;
}

export interface ChangeUserInfo {
	firstName: string;
	lastName: string;
	zipCode: string;
}

export interface UpdateReferredBy {
	referredBy: string;
}
