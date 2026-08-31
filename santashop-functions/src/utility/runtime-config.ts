import * as path from 'node:path';
import { createRequire } from 'node:module';

type EnvironmentMap = Record<string, string | undefined>;

const requireFromRuntime = createRequire(import.meta.url);

const envLoader = requireFromRuntime('../../../scripts/env-loader.cjs') as {
	loadEnvFiles: (filePaths: string[], env?: EnvironmentMap) => void;
};

interface FirebaseEnvironmentConfig {
	projectId?: string;
	storageBucket?: string;
}

const loadLocalEnvFiles = (): void => {
	const projectId =
		process.env['GCLOUD_PROJECT'] ?? process.env['GCP_PROJECT'];
	const envFiles: string[] = [];

	if (projectId) {
		envFiles.push(
			path.resolve(process.cwd(), `.env.${projectId}`),
			path.resolve(
				process.cwd(),
				`santashop-functions/.env.${projectId}`,
			),
		);
	}

	envFiles.push(
		path.resolve(process.cwd(), '.env'),
		path.resolve(process.cwd(), 'santashop-functions/.env'),
		path.resolve(__dirname, '../../.env'),
		path.resolve(__dirname, '../../../.env'),
	);

	envLoader.loadEnvFiles(envFiles);
};

loadLocalEnvFiles();

const parseList = (value: string | undefined, fallback: string[]): string[] => {
	const items = value
		?.split(',')
		.map((item) => item.trim())
		.filter((item) => item.length > 0);

	return items?.length ? items : fallback;
};

const parseFirebaseConfig = (): FirebaseEnvironmentConfig => {
	const rawConfig = process.env['FIREBASE_CONFIG'];
	if (!rawConfig) {
		return {};
	}

	try {
		return JSON.parse(rawConfig) as FirebaseEnvironmentConfig;
	} catch {
		return {};
	}
};

const firebaseConfig = parseFirebaseConfig();

const requireEnv = (name: string): string => {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}

	return value;
};

const parseRequiredInteger = (name: string): number => {
	const parsed = Number.parseInt(requireEnv(name), 10);
	if (Number.isNaN(parsed)) {
		throw new TypeError(`Invalid integer environment variable: ${name}`);
	}

	return parsed;
};

const parseRequiredYear = (name: string): number => {
	const year = parseRequiredInteger(name);
	if (year < 2000 || year > 2100) {
		throw new TypeError(`Invalid year environment variable: ${name}`);
	}
	return year;
};

export const PROGRAM_YEAR = parseRequiredYear('SANTASHOP_PROGRAM_YEAR');

export const SHOP_TIME_ZONE = requireEnv('SANTASHOP_TIME_ZONE');

export const SHOP_TIME_OFFSET = requireEnv('SANTASHOP_TIME_OFFSET');

export const SHOP_DAYS = parseList(process.env['SANTASHOP_SHOP_DAYS'], []);

export const DEFAULT_MAX_SLOTS = parseRequiredInteger(
	'SANTASHOP_DEFAULT_MAX_SLOTS',
);

export const FIRESTORE_BACKUP_BUCKET = requireEnv('FIRESTORE_BACKUP_BUCKET');

export const SES_REGION =
	process.env['SES_REGION'] ??
	process.env['AWS_REGION'] ??
	requireEnv('SES_REGION');

export const REGISTRATION_EMAIL_TEMPLATE = requireEnv(
	'REGISTRATION_EMAIL_TEMPLATE',
);

export const REMINDER_EMAIL_TEMPLATE = requireEnv('REMINDER_EMAIL_TEMPLATE');

export const EVENT_DISPLAY_NAME = requireEnv('SANTASHOP_EVENT_DISPLAY_NAME');
const configuredEventYear = /\b(?:20\d{2}|2100)\b/u.exec(EVENT_DISPLAY_NAME);
if (
	configuredEventYear &&
	Number.parseInt(configuredEventYear[0], 10) !== PROGRAM_YEAR
) {
	throw new Error(
		'SANTASHOP_EVENT_DISPLAY_NAME year must match SANTASHOP_PROGRAM_YEAR.',
	);
}

const parseOptionalInstanceCount = (name: string): number => {
	const value = process.env[name];
	if (value === undefined || value === '') return 0;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
		throw new TypeError(`${name} must be a whole number between 0 and 10.`);
	}
	return parsed;
};

export const SIGNUP_MIN_INSTANCES = parseOptionalInstanceCount(
	'SANTASHOP_SIGNUP_MIN_INSTANCES',
);
export const EVENT_MIN_INSTANCES = parseOptionalInstanceCount(
	'SANTASHOP_EVENT_MIN_INSTANCES',
);
export const FUNCTIONS_SERVICE_ACCOUNT =
	process.env['SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT'] || undefined;

export const REMINDER_EMAIL_SENDING_STALE_MINUTES = Number.parseInt(
	process.env['REMINDER_EMAIL_SENDING_STALE_MINUTES'] ?? '15',
	10,
);

export const REGISTRATION_EMAIL_SOURCE = requireEnv(
	'REGISTRATION_EMAIL_SOURCE',
);

export const REGISTRATION_EMAIL_RETURN_PATH = requireEnv(
	'REGISTRATION_EMAIL_RETURN_PATH',
);

export const SCHEDULED_FIRESTORE_BACKUP = requireEnv(
	'SCHEDULED_FIRESTORE_BACKUP',
);

export const SCHEDULED_DATETIME_SLOT_COUNTERS = requireEnv(
	'SCHEDULED_DATETIME_SLOT_COUNTERS',
);

export const SCHEDULED_REGISTRATION_STATS = requireEnv(
	'SCHEDULED_REGISTRATION_STATS',
);

export const SCHEDULED_USER_STATS = requireEnv('SCHEDULED_USER_STATS');

export const SCHEDULED_CHECKIN_STATS = requireEnv('SCHEDULED_CHECKIN_STATS');

export const getStatsDocumentId = (
	statName: 'schedule' | 'registration' | 'checkin' | 'user',
): string => {
	return `${statName}-${PROGRAM_YEAR}`;
};

export const createShopDate = (day: string, hour: number): Date => {
	const safeHour = hour.toString().padStart(2, '0');
	return new Date(
		`${PROGRAM_YEAR}-${day}T${safeHour}:00:00${SHOP_TIME_OFFSET}`,
	);
};
export const getStorageBucketName = (): string => {
	return (
		process.env['FIREBASE_STORAGE_BUCKET'] ??
		firebaseConfig.storageBucket ??
		`${
			firebaseConfig.projectId ??
			process.env['GCLOUD_PROJECT'] ??
			process.env['GCP_PROJECT'] ??
			requireEnv('GCLOUD_PROJECT')
		}.appspot.com`
	);
};
