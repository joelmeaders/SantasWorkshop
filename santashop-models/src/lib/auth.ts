export interface Auth {
	emailAddress: string;
	password: string;
}

export interface EmailChangeRequest {
	mutationId: string;
	emailAddress: string;
	expectedEmailAddress: string;
}

export interface UserEmailUid {
	emailAddress: string | null;
	uid: string;
}
