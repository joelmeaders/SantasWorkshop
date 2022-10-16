export interface OnboardUser {
	firstName: string;
	lastName: string;
	emailAddress: string;
	password: string;
	password2: string;
	zipCode: number;
	legal: boolean | Date;
}

export interface ChangeUserInfo {
	firstName: string;
	lastName: string;
	zipCode: number;
}
