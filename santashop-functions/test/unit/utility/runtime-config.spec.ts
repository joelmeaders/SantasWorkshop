import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EnvironmentMap = Record<string, string | undefined>;

const requireFromTest = createRequire(import.meta.url);
const realEnvLoader = requireFromTest('../../../../scripts/env-loader.cjs') as {
	loadEnvFiles: (filePaths: string[], env?: EnvironmentMap) => void;
};
const originalLoadEnvFiles = realEnvLoader.loadEnvFiles;

const RUNTIME_ENV_KEYS = [
	'FIREBASE_CONFIG',
	'FIREBASE_STORAGE_BUCKET',
	'GCLOUD_PROJECT',
	'GCP_PROJECT',
	'SANTASHOP_PROGRAM_YEAR',
	'SANTASHOP_TIME_ZONE',
	'SANTASHOP_TIME_OFFSET',
	'SANTASHOP_SHOP_DAYS',
	'SANTASHOP_DEFAULT_MAX_SLOTS',
	'FIRESTORE_BACKUP_BUCKET',
	'SES_REGION',
	'AWS_REGION',
	'REGISTRATION_EMAIL_TEMPLATE',
	'REMINDER_EMAIL_TEMPLATE',
	'SANTASHOP_EVENT_DISPLAY_NAME',
	'REMINDER_EMAIL_SENDING_STALE_MINUTES',
	'SANTASHOP_SIGNUP_MIN_INSTANCES',
	'SANTASHOP_EVENT_MIN_INSTANCES',
	'SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT',
	'REGISTRATION_EMAIL_SOURCE',
	'REGISTRATION_EMAIL_RETURN_PATH',
	'SCHEDULED_FIRESTORE_BACKUP',
	'SCHEDULED_DATETIME_SLOT_COUNTERS',
	'SCHEDULED_REGISTRATION_STATS',
	'SCHEDULED_USER_STATS',
	'SCHEDULED_CHECKIN_STATS',
];

const BASE_RUNTIME_ENV = {
	FIREBASE_CONFIG: JSON.stringify({
		projectId: 'santas-workshop-test',
		storageBucket: 'santas-workshop-test.appspot.com',
	}),
	GCLOUD_PROJECT: 'santas-workshop-test',
	SANTASHOP_PROGRAM_YEAR: '2025',
	SANTASHOP_TIME_ZONE: 'America/Denver',
	SANTASHOP_TIME_OFFSET: '-07:00',
	SANTASHOP_SHOP_DAYS: '12-12,12-13',
	SANTASHOP_DEFAULT_MAX_SLOTS: '350',
	FIRESTORE_BACKUP_BUCKET: 'gs://santashop-backups',
	SES_REGION: 'us-west-2',
	REGISTRATION_EMAIL_TEMPLATE: 'registration-template',
	REMINDER_EMAIL_TEMPLATE: 'reminder-template',
	SANTASHOP_EVENT_DISPLAY_NAME: 'Denver Santa Claus Shop',
	REMINDER_EMAIL_SENDING_STALE_MINUTES: '15',
	SANTASHOP_SIGNUP_MIN_INSTANCES: '1',
	SANTASHOP_EVENT_MIN_INSTANCES: '0',
	SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT:
		'santashop-functions-runtime@santas-workshop-test.iam.gserviceaccount.com',
	REGISTRATION_EMAIL_SOURCE: 'noreply@example.com',
	REGISTRATION_EMAIL_RETURN_PATH: 'admin@example.com',
	SCHEDULED_FIRESTORE_BACKUP: '0 0 * * *',
	SCHEDULED_DATETIME_SLOT_COUNTERS: '*/5 * * * *',
	SCHEDULED_REGISTRATION_STATS: '1 1 * * *',
	SCHEDULED_USER_STATS: '2 2 * * *',
	SCHEDULED_CHECKIN_STATS: '3 3 * * *',
} satisfies Record<string, string>;

const originalEnv = new Map<string, string | undefined>();
const originalWorkingDirectory = process.cwd();
const tempDirectories: string[] = [];

const createTempDirectory = (): string => {
	const directoryPath = fs.mkdtempSync(
		path.join(os.tmpdir(), 'santashop-runtime-config-'),
	);
	tempDirectories.push(directoryPath);
	return directoryPath;
};

const setRuntimeEnv = (entries: Record<string, string | undefined>): void => {
	for (const key of RUNTIME_ENV_KEYS) {
		delete process.env[key];
	}

	for (const [key, value] of Object.entries(entries)) {
		if (value !== undefined) {
			process.env[key] = value;
		}
	}
};

const writeEnvFile = (
	filePath: string,
	entries: Record<string, string | undefined>,
): void => {
	const fileContents = Object.entries(entries)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${value}`)
		.join('\n');
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${fileContents}\n`, 'utf8');
};

const loadRuntimeConfig = async (): Promise<
	typeof import('../../../src/utility/runtime-config')
> => {
	vi.resetModules();
	realEnvLoader.loadEnvFiles = (
		filePaths: string[],
		env?: EnvironmentMap,
	): void => {
		const currentWorkingDirectory = process.cwd();
		originalLoadEnvFiles(
			filePaths.filter((filePath) =>
				path.resolve(filePath).startsWith(currentWorkingDirectory),
			),
			env,
		);
	};
	return import('../../../src/utility/runtime-config');
};

beforeEach(() => {
	for (const key of RUNTIME_ENV_KEYS) {
		if (!originalEnv.has(key)) {
			originalEnv.set(key, process.env[key]);
		}
	}
	process.chdir(originalWorkingDirectory);
	setRuntimeEnv(BASE_RUNTIME_ENV);
});

afterEach(() => {
	process.chdir(originalWorkingDirectory);
	for (const key of RUNTIME_ENV_KEYS) {
		const originalValue = originalEnv.get(key);
		if (originalValue === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = originalValue;
		}
	}
	originalEnv.clear();
	for (const directoryPath of tempDirectories.splice(0)) {
		fs.rmSync(directoryPath, { recursive: true, force: true });
	}
	realEnvLoader.loadEnvFiles = originalLoadEnvFiles;
	vi.resetModules();
});

describe('runtime-config', () => {
	it('parses guarded warm-capacity and runtime-identity settings', async () => {
		const subject = await loadRuntimeConfig();

		expect(subject.SIGNUP_MIN_INSTANCES).toBe(1);
		expect(subject.EVENT_MIN_INSTANCES).toBe(0);
		expect(subject.FUNCTIONS_SERVICE_ACCOUNT).toContain(
			'santashop-functions-runtime@',
		);
	});

	it('uses AWS_REGION as a fallback when SES_REGION is not set', async () => {
		const directoryPath = createTempDirectory();
		setRuntimeEnv({
			...BASE_RUNTIME_ENV,
			SES_REGION: undefined,
			AWS_REGION: 'us-east-2',
		});
		process.chdir(directoryPath);

		const subject = await loadRuntimeConfig();

		expect(subject.SES_REGION).toBe('us-east-2');
	});

	it('prefers FIREBASE_STORAGE_BUCKET over FIREBASE_CONFIG when resolving the bucket', async () => {
		const directoryPath = createTempDirectory();
		setRuntimeEnv({
			...BASE_RUNTIME_ENV,
			FIREBASE_STORAGE_BUCKET: 'explicit-bucket.appspot.com',
		});
		process.chdir(directoryPath);

		const subject = await loadRuntimeConfig();

		expect(subject.getStorageBucketName()).toBe(
			'explicit-bucket.appspot.com',
		);
	});

	it('derives the bucket from FIREBASE_CONFIG projectId when no bucket is set', async () => {
		const directoryPath = createTempDirectory();
		setRuntimeEnv({
			...BASE_RUNTIME_ENV,
			GCLOUD_PROJECT: undefined,
			FIREBASE_CONFIG: JSON.stringify({ projectId: 'derived-project' }),
		});
		process.chdir(directoryPath);

		const subject = await loadRuntimeConfig();

		expect(subject.getStorageBucketName()).toBe(
			'derived-project.appspot.com',
		);
	});

	it('loads missing values from the current working directory .env without overwriting existing env', async () => {
		const directoryPath = createTempDirectory();
		writeEnvFile(path.join(directoryPath, '.env'), {
			...BASE_RUNTIME_ENV,
			SANTASHOP_TIME_ZONE: 'America/Chicago',
		});

		setRuntimeEnv({
			SANTASHOP_TIME_ZONE: 'America/Denver',
		});
		process.chdir(directoryPath);

		const subject = await loadRuntimeConfig();

		expect(subject.SHOP_TIME_ZONE).toBe('America/Denver');
		expect(subject.PROGRAM_YEAR).toBe(2025);
		expect(subject.REGISTRATION_EMAIL_TEMPLATE).toBe(
			'registration-template',
		);
	});

	it('falls back to santashop-functions/.env in the current working directory when root .env is absent', async () => {
		const directoryPath = createTempDirectory();
		writeEnvFile(path.join(directoryPath, 'santashop-functions/.env'), {
			...BASE_RUNTIME_ENV,
			SANTASHOP_EVENT_DISPLAY_NAME: 'Functions File Event',
		});

		setRuntimeEnv({});
		process.chdir(directoryPath);

		const subject = await loadRuntimeConfig();

		expect(subject.EVENT_DISPLAY_NAME).toBe('Functions File Event');
		expect(subject).not.toHaveProperty('ADMIN_UIDS');
	});

	it('loads the project-specific Functions env file generated for the emulator', async () => {
		const directoryPath = createTempDirectory();
		writeEnvFile(
			path.join(
				directoryPath,
				'santashop-functions/.env.santas-workshop-test',
			),
			{
				...BASE_RUNTIME_ENV,
				SANTASHOP_EVENT_DISPLAY_NAME: 'Project File Event',
			},
		);

		setRuntimeEnv({ GCLOUD_PROJECT: 'santas-workshop-test' });
		process.chdir(directoryPath);

		const subject = await loadRuntimeConfig();

		expect(subject.EVENT_DISPLAY_NAME).toBe('Project File Event');
	});

	it('loads the project-specific Functions env file from the Functions cwd', async () => {
		const directoryPath = createTempDirectory();
		writeEnvFile(path.join(directoryPath, '.env.santas-workshop-test'), {
			...BASE_RUNTIME_ENV,
			SANTASHOP_EVENT_DISPLAY_NAME: 'Functions Cwd Project File Event',
		});

		setRuntimeEnv({ GCLOUD_PROJECT: 'santas-workshop-test' });
		process.chdir(directoryPath);

		const subject = await loadRuntimeConfig();

		expect(subject.EVENT_DISPLAY_NAME).toBe(
			'Functions Cwd Project File Event',
		);
	});
});
