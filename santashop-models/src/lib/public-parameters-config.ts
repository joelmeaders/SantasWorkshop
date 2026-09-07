import type { PublicParameters } from './parameters';
import { PUBLIC_PARAMETERS_RELEASE_DEFAULTS } from './public-parameters.defaults';

export const PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY =
	'santashop_public_parameters';
export const PUBLIC_PARAMETERS_RETRY_DELAYS_MS = [
	10_000, 30_000, 60_000, 300_000,
] as const;

export interface PublicParametersSettingsResponse {
	settings: PublicParameters;
	etag: string;
	version: string;
}

export interface PublishPublicParametersRequest {
	settings: PublicParameters;
	expectedEtag: string;
}

export interface PublicParametersStatus {
	source: 'defaults' | 'remote' | 'local';
	refreshing: boolean;
	lastUpdatedAt?: number;
	error?: string;
}

const requireObject = (
	value: unknown,
	keys: readonly string[],
	field: string,
): Record<string, unknown> => {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${field} must be an object.`);
	}
	const record = value as Record<string, unknown>;
	if (Object.keys(record).some((key) => !keys.includes(key))) {
		throw new Error(`${field} contains an unknown field.`);
	}
	return record;
};

const requireBoolean = (
	record: Record<string, unknown>,
	key: string,
	prefix = '',
): boolean => {
	const value = record[key];
	if (typeof value !== 'boolean') {
		throw new Error(`${prefix}${key} must be a boolean.`);
	}
	return value;
};

const requireString = (
	record: Record<string, unknown>,
	key: string,
	prefix = '',
): string => {
	const value = record[key];
	if (typeof value !== 'string') {
		throw new Error(`${prefix}${key} must be a string.`);
	}
	return value;
};

/** Validate the complete configuration without coercion, then return an independent object. */
export const parsePublicParameters = (input: unknown): PublicParameters => {
	const value = requireObject(
		input,
		[
			'registrationEnabled',
			'maintenanceModeEnabled',
			'weatherModeEnabled',
			'createAccountEnabled',
			'messageEn',
			'messageEs',
			'admin',
			'globalAlert',
		],
		'Settings',
	);
	const admin = requireObject(
		value['admin'],
		[
			'checkinEnabled',
			'onsiteRegistrationEnabled',
			'preRegistrationEnabled',
			'allowCancelRegistration',
			'allowChangeRegistration',
		],
		'admin',
	);
	const alert = requireObject(
		value['globalAlert'],
		['displayAlert', 'titleEn', 'titleEs', 'messageEn', 'messageEs'],
		'globalAlert',
	);
	return {
		registrationEnabled: requireBoolean(value, 'registrationEnabled'),
		maintenanceModeEnabled: requireBoolean(value, 'maintenanceModeEnabled'),
		weatherModeEnabled: requireBoolean(value, 'weatherModeEnabled'),
		createAccountEnabled: requireBoolean(value, 'createAccountEnabled'),
		messageEn: requireString(value, 'messageEn'),
		messageEs: requireString(value, 'messageEs'),
		admin: {
			checkinEnabled: requireBoolean(admin, 'checkinEnabled', 'admin.'),
			onsiteRegistrationEnabled: requireBoolean(
				admin,
				'onsiteRegistrationEnabled',
				'admin.',
			),
			preRegistrationEnabled: requireBoolean(
				admin,
				'preRegistrationEnabled',
				'admin.',
			),
			allowCancelRegistration: requireBoolean(
				admin,
				'allowCancelRegistration',
				'admin.',
			),
			allowChangeRegistration: requireBoolean(
				admin,
				'allowChangeRegistration',
				'admin.',
			),
		},
		globalAlert: {
			displayAlert: requireBoolean(alert, 'displayAlert', 'globalAlert.'),
			titleEn: requireString(alert, 'titleEn', 'globalAlert.'),
			titleEs: requireString(alert, 'titleEs', 'globalAlert.'),
			messageEn: requireString(alert, 'messageEn', 'globalAlert.'),
			messageEs: requireString(alert, 'messageEs', 'globalAlert.'),
		},
	};
};

export const parsePublicParametersJson = (input: string): PublicParameters =>
	parsePublicParameters(JSON.parse(input) as unknown);

export const createDefaultPublicParameters = (): PublicParameters =>
	parsePublicParameters(PUBLIC_PARAMETERS_RELEASE_DEFAULTS);
