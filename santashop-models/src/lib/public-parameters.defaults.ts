import type { PublicParameters } from './parameters';

/** Local defaults. Release tooling replaces this file with validated project settings. */
export const PUBLIC_PARAMETERS_RELEASE_DEFAULTS: PublicParameters = {
	registrationEnabled: true,
	maintenanceModeEnabled: false,
	weatherModeEnabled: false,
	createAccountEnabled: true,
	messageEn: '',
	messageEs: '',
	admin: {
		checkinEnabled: true,
		onsiteRegistrationEnabled: true,
		preRegistrationEnabled: true,
		allowCancelRegistration: true,
		allowChangeRegistration: true,
	},
	globalAlert: {
		displayAlert: false,
		titleEn: '',
		titleEs: '',
		messageEn: '',
		messageEs: '',
	},
};
