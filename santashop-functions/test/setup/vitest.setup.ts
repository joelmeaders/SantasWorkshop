import { afterEach, vi } from 'vitest';

process.env['TZ'] = 'UTC';
process.env['GCLOUD_PROJECT'] = 'santas-workshop-test';
process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
process.env['FIREBASE_STORAGE_EMULATOR_HOST'] = '127.0.0.1:9199';
process.env['FIREBASE_CONFIG'] = JSON.stringify({
	projectId: 'santas-workshop-test',
	storageBucket: 'santas-workshop-test.appspot.com',
});
process.env['SANTASHOP_PROGRAM_YEAR'] = '2025';
process.env['SANTASHOP_TIME_ZONE'] = 'America/Denver';
process.env['SANTASHOP_TIME_OFFSET'] = '-07:00';
process.env['SANTASHOP_SHOP_DAYS'] = '12-12,12-13,12-15,12-16';
process.env['SANTASHOP_DEFAULT_MAX_SLOTS'] = '350';
process.env['FIRESTORE_BACKUP_BUCKET'] = 'gs://santashop-backups';
process.env['SES_REGION'] = 'us-west-2';
process.env['REGISTRATION_EMAIL_TEMPLATE'] =
	'dscs-registration-confirmation-v1';
process.env['REMINDER_EMAIL_TEMPLATE'] = 'dscs-event-reminder';
process.env['SANTASHOP_EVENT_DISPLAY_NAME'] = '2025 Denver Santa Claus Shop';
process.env['REMINDER_EMAIL_SENDING_STALE_MINUTES'] = '15';
process.env['REGISTRATION_EMAIL_SOURCE'] = 'noreply@denversantaclausshop.org';
process.env['REGISTRATION_EMAIL_RETURN_PATH'] =
	'admin@denversantaclausshop.org';
process.env['ADMIN_UIDS'] = [
	'bIMHv99EssTqMfhX2kkYm2vErwu1',
	'xkeLDNPTVVPkt6Onh4EGYNuGi2C2',
	'sGVW9Om1E5UGKWcq97EpygbwQfl2',
	'2kNkKB4Xz5agjs6TfXzQStJ38gx1',
	'RDkrgjJE0oQAXY6peLoABJvOH2j2',
].join(',');
process.env['ADMIN_BOOTSTRAP_PASSWORD'] = [
	'Unit',
	'Test',
	'Admin',
	'Password',
	'123!',
].join('');
process.env['SCHEDULED_FIRESTORE_BACKUP'] = '0 0 * 11,12 *';
process.env['SCHEDULED_DATETIME_SLOT_COUNTERS'] = '*/5 * * 11,12 *';
process.env['SCHEDULED_REGISTRATION_STATS'] = '59 23 * * *';
process.env['SCHEDULED_USER_STATS'] = '55 23 * 11,12 *';
process.env['SCHEDULED_CHECKIN_STATS'] =
	'*/5 10,11,12,13,14,15,16 12,13,15,16 12 *';

afterEach(() => {
	vi.restoreAllMocks();
	vi.clearAllMocks();
});
