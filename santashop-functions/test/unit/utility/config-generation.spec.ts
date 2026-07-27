import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const configFirebase = requireFromTest('../../../../config.firebase.cjs') as {
	MODE_METADATA: Record<
		string,
		{
			production: boolean;
			label: string;
			appCheckKey: string;
			appCheckEnabled: boolean;
		}
	>;
	LOCAL_FIREBASE_CONFIG: {
		apiKey: string;
		authDomain: string;
		databaseURL: string;
		projectId: string;
		storageBucket: string;
		messagingSenderId: string;
		appId: string;
		measurementId: string;
	};
	parseFirebaseConfigMode: (
		value?: string,
	) => 'dev' | 'local' | 'test' | 'prod';
	buildFirebaseClientConfig: (mode: 'dev' | 'local' | 'test' | 'prod') => {
		apiKey: string;
		authDomain: string;
		databaseURL: string;
		projectId: string;
		storageBucket: string;
		messagingSenderId: string;
		appId: string;
		measurementId: string;
	};
	buildAppConfig: (
		target: 'app' | 'admin',
		mode: 'dev' | 'local' | 'test' | 'prod',
	) => {
		production: boolean;
		label: string;
		name: string;
		version: string;
		appCheckKey: string;
		appCheckEnabled: boolean;
	};
	renderAppConfigModule: (appConfig: {
		production: boolean;
		label: string;
		name: string;
		version: string;
		appCheckKey: string;
		appCheckEnabled: boolean;
	}) => string;
	renderFirebaseConfigModule: (firebaseConfig: {
		apiKey: string;
		authDomain: string;
		databaseURL: string;
		projectId: string;
		storageBucket: string;
		messagingSenderId: string;
		appId: string;
		measurementId: string;
	}) => string;
};
const configFunctions = requireFromTest('../../../../config.functions.cjs') as {
	FUNCTION_PROJECT_IDS: Record<'local' | 'test' | 'prod', string>;
	parseMode: (value?: string) => 'local' | 'test' | 'prod';
	buildFunctionsConfig: (
		mode: 'local' | 'test' | 'prod',
	) => Record<string, string>;
	renderFunctionsEnvFile: (
		mode: 'local' | 'test' | 'prod',
		projectId: string,
		config: Record<string, string>,
	) => string;
};

const FIREBASE_ENV_KEYS = {
	TEST_FIREBASE_API_KEY: 'test-api-key',
	TEST_FIREBASE_AUTH_DOMAIN: 'test.example.firebaseapp.com',
	TEST_FIREBASE_DATABASE_URL: 'https://test.example',
	TEST_FIREBASE_PROJECT_ID: 'test-project',
	TEST_FIREBASE_STORAGE_BUCKET: 'test-bucket.appspot.com',
	TEST_FIREBASE_MESSAGING_SENDER_ID: '111111',
	TEST_FIREBASE_APP_ID: 'test-app-id',
	TEST_FIREBASE_MEASUREMENT_ID: 'G-TEST',
	PROD_FIREBASE_API_KEY: 'prod-api-key',
	PROD_FIREBASE_AUTH_DOMAIN: 'prod.example.firebaseapp.com',
	PROD_FIREBASE_DATABASE_URL: 'https://prod.example',
	PROD_FIREBASE_PROJECT_ID: 'prod-project',
	PROD_FIREBASE_STORAGE_BUCKET: 'prod-bucket.appspot.com',
	PROD_FIREBASE_MESSAGING_SENDER_ID: '999999',
	PROD_FIREBASE_APP_ID: 'prod-app-id',
	PROD_FIREBASE_MEASUREMENT_ID: 'G-PROD',
} satisfies Record<string, string>;

const FUNCTIONS_ENV_KEYS = {
	TEST_AWS_ACCESS_KEY_ID: 'test-access-key',
	TEST_AWS_SECRET_ACCESS_KEY: 'test-secret-key',
	TEST_ADMIN_BOOTSTRAP_PASSWORD: 'test-bootstrap-password',
	TEST_SANTASHOP_PROGRAM_YEAR: '2025',
	TEST_SANTASHOP_TIME_ZONE: 'America/Denver',
	TEST_SANTASHOP_TIME_OFFSET: '-07:00',
	TEST_SANTASHOP_DEFAULT_MAX_SLOTS: '350',
	TEST_FIRESTORE_BACKUP_BUCKET: 'gs://test-backups',
	TEST_SES_REGION: 'us-west-2',
	TEST_REGISTRATION_EMAIL_TEMPLATE: 'registration-template',
	TEST_REMINDER_EMAIL_TEMPLATE: 'reminder-template',
	TEST_SANTASHOP_EVENT_DISPLAY_NAME: 'Test Event',
	TEST_REGISTRATION_EMAIL_SOURCE: 'noreply@example.com',
	TEST_REGISTRATION_EMAIL_RETURN_PATH: 'admin@example.com',
	TEST_SCHEDULED_FIRESTORE_BACKUP: '0 0 * * *',
	TEST_SCHEDULED_DATETIME_SLOT_COUNTERS: '*/5 * * * *',
	TEST_SCHEDULED_REGISTRATION_STATS: '0 1 * * *',
	TEST_SCHEDULED_USER_STATS: '0 2 * * *',
	TEST_SCHEDULED_CHECKIN_STATS: '0 3 * * *',
	TEST_ADMIN_UIDS: 'admin-1,admin-2',
	TEST_SANTASHOP_SHOP_DAYS: '12-12,12-13',
	TEST_REMINDER_EMAIL_SENDING_STALE_MINUTES: '30',
	PROD_AWS_ACCESS_KEY_ID: 'prod-access-key',
	PROD_AWS_SECRET_ACCESS_KEY: 'prod-secret-key',
	PROD_ADMIN_BOOTSTRAP_PASSWORD: 'prod-bootstrap-password',
	PROD_SANTASHOP_PROGRAM_YEAR: '2030',
	PROD_SANTASHOP_TIME_ZONE: 'America/New_York',
	PROD_SANTASHOP_TIME_OFFSET: '-05:00',
	PROD_SANTASHOP_DEFAULT_MAX_SLOTS: '500',
	PROD_FIRESTORE_BACKUP_BUCKET: 'gs://prod-backups',
	PROD_SES_REGION: 'us-east-1',
	PROD_REGISTRATION_EMAIL_TEMPLATE: 'prod-registration-template',
	PROD_REMINDER_EMAIL_TEMPLATE: 'prod-reminder-template',
	PROD_SANTASHOP_EVENT_DISPLAY_NAME: 'Prod Event',
	PROD_REGISTRATION_EMAIL_SOURCE: 'prod-noreply@example.com',
	PROD_REGISTRATION_EMAIL_RETURN_PATH: 'prod-admin@example.com',
	PROD_SCHEDULED_FIRESTORE_BACKUP: '1 0 * * *',
	PROD_SCHEDULED_DATETIME_SLOT_COUNTERS: '2 * * * *',
	PROD_SCHEDULED_REGISTRATION_STATS: '3 1 * * *',
	PROD_SCHEDULED_USER_STATS: '4 2 * * *',
	PROD_SCHEDULED_CHECKIN_STATS: '5 3 * * *',
} satisfies Record<string, string>;

const MANAGED_ENV_KEYS = [
	...Object.keys(FIREBASE_ENV_KEYS),
	...Object.keys(FUNCTIONS_ENV_KEYS),
	'FIREBASE_API_KEY',
	'FIREBASE_AUTH_DOMAIN',
	'FIREBASE_DATABASE_URL',
	'FIREBASE_PROJECT_ID',
	'FIREBASE_STORAGE_BUCKET',
	'FIREBASE_MESSAGING_SENDER_ID',
	'FIREBASE_APP_ID',
	'FIREBASE_MEASUREMENT_ID',
	'AWS_ACCESS_KEY_ID',
	'AWS_SECRET_ACCESS_KEY',
	'ADMIN_BOOTSTRAP_PASSWORD',
	'SANTASHOP_PROGRAM_YEAR',
	'SANTASHOP_TIME_ZONE',
	'SANTASHOP_TIME_OFFSET',
	'SANTASHOP_DEFAULT_MAX_SLOTS',
	'FIRESTORE_BACKUP_BUCKET',
	'SES_REGION',
	'REGISTRATION_EMAIL_TEMPLATE',
	'REMINDER_EMAIL_TEMPLATE',
	'SANTASHOP_EVENT_DISPLAY_NAME',
	'REGISTRATION_EMAIL_SOURCE',
	'REGISTRATION_EMAIL_RETURN_PATH',
	'SCHEDULED_FIRESTORE_BACKUP',
	'SCHEDULED_DATETIME_SLOT_COUNTERS',
	'SCHEDULED_REGISTRATION_STATS',
	'SCHEDULED_USER_STATS',
	'SCHEDULED_CHECKIN_STATS',
	'ADMIN_UIDS',
	'SANTASHOP_SHOP_DAYS',
	'REMINDER_EMAIL_SENDING_STALE_MINUTES',
	'AWS_REGION',
];

const originalEnv = new Map<string, string | undefined>();

const setManagedEnv = (entries: Record<string, string>): void => {
	for (const key of MANAGED_ENV_KEYS) {
		delete process.env[key];
	}

	for (const [key, value] of Object.entries(entries)) {
		process.env[key] = value;
	}
};

beforeEach(() => {
	for (const key of MANAGED_ENV_KEYS) {
		if (!originalEnv.has(key)) {
			originalEnv.set(key, process.env[key]);
		}
	}
	setManagedEnv({
		...FIREBASE_ENV_KEYS,
		...FUNCTIONS_ENV_KEYS,
	});
});

afterEach(() => {
	for (const key of MANAGED_ENV_KEYS) {
		const originalValue = originalEnv.get(key);
		if (originalValue === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = originalValue;
		}
	}
	originalEnv.clear();
});

describe('config.firebase.cjs', () => {
	it('maps mode aliases to the expected normalized mode', () => {
		expect(configFirebase.parseFirebaseConfigMode('development')).toBe(
			'dev',
		);
		expect(configFirebase.parseFirebaseConfigMode('local')).toBe('local');
		expect(configFirebase.parseFirebaseConfigMode('qa')).toBe('test');
		expect(configFirebase.parseFirebaseConfigMode(undefined)).toBe('prod');
	});

	it('uses TEST variables for dev and test and PROD variables for prod', () => {
		const devConfig = configFirebase.buildFirebaseClientConfig('dev');
		const testConfig = configFirebase.buildFirebaseClientConfig('test');
		const prodConfig = configFirebase.buildFirebaseClientConfig('prod');

		expect(devConfig.apiKey).toBe(FIREBASE_ENV_KEYS.TEST_FIREBASE_API_KEY);
		expect(testConfig.projectId).toBe(
			FIREBASE_ENV_KEYS.TEST_FIREBASE_PROJECT_ID,
		);
		expect(prodConfig.apiKey).toBe(FIREBASE_ENV_KEYS.PROD_FIREBASE_API_KEY);
		expect(prodConfig.projectId).toBe(
			FIREBASE_ENV_KEYS.PROD_FIREBASE_PROJECT_ID,
		);
	});

	it('uses a hardcoded demo project for local mode without reading environment variables', () => {
		setManagedEnv({});

		expect(configFirebase.buildFirebaseClientConfig('local')).toEqual(
			configFirebase.LOCAL_FIREBASE_CONFIG,
		);
	});

	it('falls back to unprefixed Firebase values when the prefixed ones are missing', () => {
		setManagedEnv({
			FIREBASE_API_KEY: 'fallback-api-key',
			FIREBASE_AUTH_DOMAIN: 'fallback.firebaseapp.com',
			FIREBASE_DATABASE_URL: 'https://fallback.example',
			FIREBASE_PROJECT_ID: 'fallback-project',
			FIREBASE_STORAGE_BUCKET: 'fallback.appspot.com',
			FIREBASE_MESSAGING_SENDER_ID: '222222',
			FIREBASE_APP_ID: 'fallback-app-id',
			FIREBASE_MEASUREMENT_ID: 'G-FALLBACK',
		});

		const config = configFirebase.buildFirebaseClientConfig('test');

		expect(config).toEqual({
			apiKey: 'fallback-api-key',
			authDomain: 'fallback.firebaseapp.com',
			databaseURL: 'https://fallback.example',
			projectId: 'fallback-project',
			storageBucket: 'fallback.appspot.com',
			messagingSenderId: '222222',
			appId: 'fallback-app-id',
			measurementId: 'G-FALLBACK',
		});
	});

	it('builds app metadata with the expected mode flags and labels', () => {
		const config = configFirebase.buildAppConfig('app', 'test');
		const localConfig = configFirebase.buildAppConfig('app', 'local');

		expect(config.production).toBe(true);
		expect(config.label).toBe('TEST/QA');
		expect(config.appCheckKey).toBe(
			configFirebase.MODE_METADATA.test.appCheckKey,
		);
		expect(config.appCheckEnabled).toBe(true);
		expect(config.name).toBe('@santashop/app');
		expect(localConfig.appCheckEnabled).toBe(false);
	});

	it('renders app config with the mode-specific App Check flag', () => {
		const moduleText = configFirebase.renderAppConfigModule({
			production: false,
			label: 'LOCAL',
			name: '@santashop/app',
			version: '2025.2.1',
			appCheckKey: 'local-app-check-key',
			appCheckEnabled: false,
		});

		expect(moduleText).toContain('appCheckEnabled: false');
	});

	it('renders a Firebase config module with the supplied values', () => {
		const moduleText = configFirebase.renderFirebaseConfigModule({
			apiKey: 'render-api-key',
			authDomain: 'render.firebaseapp.com',
			databaseURL: 'https://render.example',
			projectId: 'render-project',
			storageBucket: 'render.appspot.com',
			messagingSenderId: '333333',
			appId: 'render-app-id',
			measurementId: 'G-RENDER',
		});

		expect(moduleText).toContain('render-api-key');
		expect(moduleText).toContain('render-project');
		expect(moduleText).toContain('export const firebaseConfig');
	});
});

describe('config.functions.cjs', () => {
	it('maps development-style aliases to the test project and defaults to prod', () => {
		expect(configFunctions.parseMode('development')).toBe('test');
		expect(configFunctions.parseMode('local')).toBe('local');
		expect(configFunctions.parseMode('qa')).toBe('test');
		expect(configFunctions.parseMode(undefined)).toBe('prod');
		expect(configFunctions.FUNCTION_PROJECT_IDS.local).toBe(
			'demo-santashop',
		);
		expect(configFunctions.FUNCTION_PROJECT_IDS.test).toBe(
			'santas-workshop-test',
		);
		expect(configFunctions.FUNCTION_PROJECT_IDS.prod).toBe(
			'santas-workshop-193b5',
		);
	});

	it('builds local Functions config from LOCAL values and falls back to unprefixed ones', () => {
		setManagedEnv({
			AWS_ACCESS_KEY_ID: 'fallback-access-key',
			AWS_SECRET_ACCESS_KEY: 'fallback-secret-key',
			ADMIN_BOOTSTRAP_PASSWORD: 'fallback-password',
			SANTASHOP_PROGRAM_YEAR: '2029',
			SANTASHOP_TIME_ZONE: 'America/Chicago',
			SANTASHOP_TIME_OFFSET: '-06:00',
			SANTASHOP_DEFAULT_MAX_SLOTS: '250',
			FIRESTORE_BACKUP_BUCKET: 'gs://fallback-backups',
			SES_REGION: 'us-central-1',
			REGISTRATION_EMAIL_TEMPLATE: 'fallback-registration',
			REMINDER_EMAIL_TEMPLATE: 'fallback-reminder',
			SANTASHOP_EVENT_DISPLAY_NAME: 'Fallback Event',
			REGISTRATION_EMAIL_SOURCE: 'fallback@example.com',
			REGISTRATION_EMAIL_RETURN_PATH: 'fallback-admin@example.com',
			SCHEDULED_FIRESTORE_BACKUP: '10 0 * * *',
			SCHEDULED_DATETIME_SLOT_COUNTERS: '11 * * * *',
			SCHEDULED_REGISTRATION_STATS: '12 1 * * *',
			SCHEDULED_USER_STATS: '13 2 * * *',
			SCHEDULED_CHECKIN_STATS: '14 3 * * *',
			LOCAL_SANTASHOP_EVENT_DISPLAY_NAME: 'Local Event',
			LOCAL_SES_REGION: 'us-west-1',
		});

		const config = configFunctions.buildFunctionsConfig('local');

		expect(config['AWS_ACCESS_KEY_ID']).toBe('fallback-access-key');
		expect(config['SES_REGION']).toBe('us-west-1');
		expect(config['SANTASHOP_EVENT_DISPLAY_NAME']).toBe('Local Event');
	});

	it('builds test Functions config from TEST values and omits empty optional values', () => {
		setManagedEnv({
			...FUNCTIONS_ENV_KEYS,
			TEST_ADMIN_UIDS: '',
			TEST_REMINDER_EMAIL_SENDING_STALE_MINUTES: '',
		});

		const config = configFunctions.buildFunctionsConfig('test');

		expect(config['AWS_ACCESS_KEY_ID']).toBe(
			FUNCTIONS_ENV_KEYS.TEST_AWS_ACCESS_KEY_ID,
		);
		expect(config['SANTASHOP_EVENT_DISPLAY_NAME']).toBe('Test Event');
		expect(config['ADMIN_UIDS']).toBeUndefined();
		expect(config['REMINDER_EMAIL_SENDING_STALE_MINUTES']).toBeUndefined();
	});

	it('falls back to unprefixed Functions values when prefixed values are missing', () => {
		setManagedEnv({
			AWS_ACCESS_KEY_ID: 'fallback-access-key',
			AWS_SECRET_ACCESS_KEY: 'fallback-secret-key',
			ADMIN_BOOTSTRAP_PASSWORD: 'fallback-password',
			SANTASHOP_PROGRAM_YEAR: '2029',
			SANTASHOP_TIME_ZONE: 'America/Chicago',
			SANTASHOP_TIME_OFFSET: '-06:00',
			SANTASHOP_DEFAULT_MAX_SLOTS: '250',
			FIRESTORE_BACKUP_BUCKET: 'gs://fallback-backups',
			SES_REGION: 'us-central-1',
			REGISTRATION_EMAIL_TEMPLATE: 'fallback-registration',
			REMINDER_EMAIL_TEMPLATE: 'fallback-reminder',
			SANTASHOP_EVENT_DISPLAY_NAME: 'Fallback Event',
			REGISTRATION_EMAIL_SOURCE: 'fallback@example.com',
			REGISTRATION_EMAIL_RETURN_PATH: 'fallback-admin@example.com',
			SCHEDULED_FIRESTORE_BACKUP: '10 0 * * *',
			SCHEDULED_DATETIME_SLOT_COUNTERS: '11 * * * *',
			SCHEDULED_REGISTRATION_STATS: '12 1 * * *',
			SCHEDULED_USER_STATS: '13 2 * * *',
			SCHEDULED_CHECKIN_STATS: '14 3 * * *',
		});

		const config = configFunctions.buildFunctionsConfig('prod');

		expect(config['AWS_ACCESS_KEY_ID']).toBe('fallback-access-key');
		expect(config['SES_REGION']).toBe('us-central-1');
		expect(config['SANTASHOP_EVENT_DISPLAY_NAME']).toBe('Fallback Event');
	});

	it('renders a quoted env file for the selected project', () => {
		const fileText = configFunctions.renderFunctionsEnvFile(
			'test',
			'santas-workshop-test',
			configFunctions.buildFunctionsConfig('test'),
		);

		expect(fileText).toContain(
			'# This file is auto-generated by config.functions.cjs for santas-workshop-test (test).',
		);
		expect(fileText).toContain('AWS_ACCESS_KEY_ID="test-access-key"');
		expect(fileText).toContain('SANTASHOP_EVENT_DISPLAY_NAME="Test Event"');
	});
});
