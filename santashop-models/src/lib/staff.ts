export type StaffRole = 'admin' | 'checkin';

export const STAFF_ROLES: readonly StaffRole[] = ['admin', 'checkin'];

export interface StaffAccount {
	uid: string;
	displayName: string;
	emailAddress: string;
	roles: StaffRole[];
	disabled: boolean;
	createdOn: Date;
	updatedOn: Date;
}

export interface CreateStaffUser {
	emailAddress: string;
	displayName: string;
	password: string;
	roles: StaffRole[];
}

export interface UpdateStaffUser {
	uid: string;
	displayName?: string;
	roles?: StaffRole[];
	newPassword?: string;
	disabled?: boolean;
}

export interface DeleteStaffUser {
	uid: string;
}
