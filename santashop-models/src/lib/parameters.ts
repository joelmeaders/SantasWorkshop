import { GlobalAlert } from './global-alert';

export interface PublicParameters {
	registrationEnabled: boolean;
	maintenanceModeEnabled: boolean;
	weatherModeEnabled: boolean;
	createAccountEnabled: boolean;
	messageEn: string;
	messageEs: string;
	admin: {
		checkinEnabled: boolean;
		onsiteRegistrationEnabled: boolean;
		preRegistrationEnabled: boolean;
		allowCancelRegistration: boolean;
	};
	globalAlert: GlobalAlert;
}
