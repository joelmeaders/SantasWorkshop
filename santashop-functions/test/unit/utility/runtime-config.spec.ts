import { afterEach, describe, expect, it, vi } from 'vitest';

const BASE_RUNTIME_ENV = {
	FIREBASE_CONFIG: JSON.stringify({
		projectId: 'santas-workshop-test',
		storageBucket: 'santas-workshop-test.appspot.com',
	}),
	GCLOUD_PROJECT: 'santas-workshop-test',
	SANTASHOP_PROGRAM_YEAR: '2025',
	SANTASHOP_TIME_ZONE: 'America/Denver',
	SANTASHOP_SHOP_DAYS: '12-12,12-13',
	SANTASHOP_DEFAULT_MAX_SLOTS: '350',
	FIRESTORE_BACKUP_BUCKET: 'gs://santashop-backups',
	SES_REGION: 'us-west-2',
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

const loadRuntimeConfig = async (
	overrides: Record<string, string | undefined> = {},
): Promise<typeof import('../../../src/utility/runtime-config')> => {
	vi.resetModules();
	for (const [key, value] of Object.entries({
		...BASE_RUNTIME_ENV,
		...overrides,
	}))
		vi.stubEnv(key, value);
	return import('../../../src/utility/runtime-config');
};

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe('runtime configuration', () => {
	it('creates winter and summer appointments from the configured named zone', async () => {
		const config = await loadRuntimeConfig();
		expect(config.createShopDate('12-12', 10).toISOString()).toBe(
			'2025-12-12T17:00:00.000Z',
		);
		expect(config.createShopDate('07-12', 10).toISOString()).toBe(
			'2025-07-12T16:00:00.000Z',
		);
	});
	it('does not depend on a separate fixed UTC offset', async () => {
		const config = await loadRuntimeConfig({
			SANTASHOP_TIME_OFFSET: undefined,
			SANTASHOP_TIME_ZONE: 'America/New_York',
		});
		expect(config.createShopDate('07-12', 10).toISOString()).toBe(
			'2025-07-12T14:00:00.000Z',
		);
	});
	it('reads scoped runtime values supplied by Firebase', async () => {
		const config = await loadRuntimeConfig();
		expect(config.PROGRAM_YEAR).toBe(2025);
		expect(config.SIGNUP_MIN_INSTANCES).toBe(1);
		expect(config.EVENT_MIN_INSTANCES).toBe(0);
		expect(config.FUNCTIONS_SERVICE_ACCOUNT).toContain(
			'santashop-functions-runtime@',
		);
	});
	it('requires an explicit SES region', async () => {
		await expect(
			loadRuntimeConfig({
				SES_REGION: undefined,
				AWS_REGION: 'us-east-2',
			}),
		).rejects.toThrow('SES_REGION');
	});
	it('uses the configured Storage bucket', async () => {
		const config = await loadRuntimeConfig({
			FIREBASE_STORAGE_BUCKET: 'configured-bucket.appspot.com',
		});
		expect(config.getStorageBucketName()).toBe(
			'configured-bucket.appspot.com',
		);
	});
	it('requires runtime configuration without searching local dotenv files', async () => {
		await expect(
			loadRuntimeConfig({ SANTASHOP_PROGRAM_YEAR: undefined }),
		).rejects.toThrow('SANTASHOP_PROGRAM_YEAR');
	});
});
