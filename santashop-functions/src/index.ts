import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
	SCHEDULED_CHECKIN_STATS,
	SCHEDULED_DATETIME_SLOT_COUNTERS,
	SCHEDULED_FIRESTORE_BACKUP,
	SCHEDULED_REGISTRATION_STATS,
	SCHEDULED_USER_STATS,
	SHOP_TIME_ZONE,
} from './utility/runtime-config';

export const changeAccountInformation = onCall(
	{ enforceAppCheck: true },
	async (request) => {
		return (await import('./fn/changeAccountInformation')).default(request);
	},
);

export const updateReferredBy = onCall(
	{ enforceAppCheck: true },
	async (request) => {
		return (await import('./fn/updateReferredBy')).default(request);
	},
);

/**
 * Runs a method to validate and complete a user registration record.
 * This process locks down their selected dateTimeSlot, sends an email
 * and sets the submitted timestamp on their record.
 *
 * @remarks
 * registration-email, RegistrationSearchIndex
 */
export const completeRegistration = onCall(
	{ enforceAppCheck: true },
	async (request) => {
		return (await import('./fn/completeRegistration')).default(request);
	},
);

export const newAccount = onCall({ enforceAppCheck: true }, async (request) => {
	return (await import('./fn/newAccount')).default(request);
});

export const undoRegistration = onCall(
	{ enforceAppCheck: true },
	async (request) => {
		return (await import('./fn/undoRegistration')).default(request);
	},
);

export const changeRegistrationDateTime = onCall(
	{ enforceAppCheck: true },
	async (request) => {
		return (await import('./fn/changeRegistrationDateTime')).default(
			request,
		);
	},
);

export const updateEmailAddress = onCall(
	{ enforceAppCheck: true },
	async (request) => {
		return (await import('./fn/updateEmailAddress')).default(request);
	},
);

export const checkIn = onCall({ enforceAppCheck: true }, async (request) => {
	return (await import('./fn/checkIn')).default(request);
});

export const checkInWithEdit = onCall(
	{ enforceAppCheck: true },
	async (request) => {
		return (await import('./fn/checkInWithEdit')).default(request);
	},
);

export const onSiteRegistration = onCall(
	{ enforceAppCheck: true },
	async (request) => {
		return (await import('./fn/onSiteRegistration')).default(request);
	},
);

export const callableAdminPreRegister = onCall(
	{ enforceAppCheck: true },
	async (request) => {
		return (await import('./fn/callableAdminPreRegister')).default(request);
	},
);

export const callableResendRegistrationEmail = onCall(
	{ enforceAppCheck: true, maxInstances: 2, memory: '128MiB' },
	async (request) => {
		return (await import('./fn/callableResendRegistrationEmail')).default(
			request,
		);
	},
);

export const callableCreateStaffUser = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	async (request) => {
		return (await import('./fn/callableCreateStaffUser')).default(request);
	},
);

export const callableUpdateStaffUser = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	async (request) => {
		return (await import('./fn/callableUpdateStaffUser')).default(request);
	},
);

export const callableDeleteStaffUser = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	async (request) => {
		return (await import('./fn/callableDeleteStaffUser')).default(request);
	},
);

// ------------------------------------- TRIGGER FUNCTIONS

export const sendNewRegistrationEmails = onDocumentCreated(
	{
		document: 'tmp_registrationemails/{docId}',
		secrets: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
		retry: true,
		maxInstances: 1,
	},
	async (event) => {
		if (!event.data) {
			return;
		}

		await (
			await import('./fn/sendNewRegistrationEmails2')
		).default(event.data);
	},
);

// ------------------------------------- SCHEDULED FUNCTIONS

/**
 * Backs up firestore db every night to storage bucket
 * At 00:00 in November and December
 */
export const scheduledFirestoreBackup = onSchedule(
	{
		schedule: SCHEDULED_FIRESTORE_BACKUP,
		memory: '256MiB',
		timeoutSeconds: 240,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/scheduledFirestoreBackup')).default();
	},
);

// At every 15th minute in November and December.
export const scheduledDateTimeSlotCounters = onSchedule(
	{
		schedule: SCHEDULED_DATETIME_SLOT_COUNTERS,
		memory: '128MiB',
		timeoutSeconds: 30,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/scheduledDateTimeSlotCounters2')).default();
	},
);

// “At 23:59.” (11:59 PM) every day.
export const scheduledRegistrationStats = onSchedule(
	{
		schedule: SCHEDULED_REGISTRATION_STATS,
		timeZone: SHOP_TIME_ZONE,
		memory: '256MiB',
		timeoutSeconds: 240,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/scheduledRegistrationStats')).default();
	},
);

// “At 23:55.” (11:55 PM) every day in November and December.
export const scheduledUserStats = onSchedule(
	{
		schedule: SCHEDULED_USER_STATS,
		timeZone: SHOP_TIME_ZONE,
		memory: '256MiB',
		timeoutSeconds: 60,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/scheduledUserStats')).default();
	},
);

// At every 5th minute past hour 10, 11, 12, 13, 14, 15, and 16 on day-of-month 8, 9, 11, and 12 in December.
export const scheduledCheckInStats = onSchedule(
	{
		schedule: SCHEDULED_CHECKIN_STATS,
		timeZone: SHOP_TIME_ZONE,
		memory: '256MiB',
		timeoutSeconds: 60,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/scheduledCheckInStats')).default();
	},
);

// ------------------------------------- PUBSUB FUNCTIONS
export const pubsubResetCheckInStats = onMessagePublished(
	{
		topic: 'reset-checkin-stats',
		memory: '256MiB',
		timeoutSeconds: 60,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/pubsubResetCheckInStats')).default();
	},
);

export const pubsubQueueReminderEmails = onMessagePublished(
	{
		topic: 'queue-reminder-emails',
		memory: '256MiB',
		timeoutSeconds: 540,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/pubsubQueueReminderEmails')).default();
	},
);

export const pubsubSetAdminRights = onMessagePublished(
	{
		topic: 'set-admin-rights',
		memory: '256MiB',
		timeoutSeconds: 60,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/pubsubSetAdminRights')).default();
	},
);

export const pubsubMarkRegistrationsCheckedIn = onMessagePublished(
	{
		topic: 'mark-registrations-checked-in',
		memory: '256MiB',
		timeoutSeconds: 60,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/pubsubMarkRegistrationsCheckedIn')).default();
	},
);

export const pubsubExportMarketingEmails = onMessagePublished(
	{
		topic: 'export-marketing-emails',
		memory: '256MiB',
		timeoutSeconds: 60,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/pubsubExportMarketingEmails')).default();
	},
);

export const pubsubExportRegisteredEmails = onMessagePublished(
	{
		topic: 'export-registered-emails',
		memory: '256MiB',
		timeoutSeconds: 60,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/pubsubExportRegisteredEmails')).default();
	},
);

// This method checks for existing dates/times.
// If there are none it adds them
export const pubsubAddDateTimeSlots = onMessagePublished(
	{
		topic: 'create-datetime-slots',
		memory: '256MiB',
		timeoutSeconds: 60,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/pubsubAddDateTimeSlots')).default();
	},
);

// Deletes all users except for disabled accounts
export const pubsubDeleteUsers = onMessagePublished(
	{
		topic: 'delete-users',
		memory: '256MiB',
		timeoutSeconds: 60,
		maxInstances: 1,
	},
	async () => {
		await (await import('./fn/pubsubDeleteUsers')).default();
	},
);

// ------------------------------------- TEST HELPER FUNCTIONS (Emulator Only)
// These functions are only available when running in the Firebase emulator
// They should NOT be deployed to production

// Only export test functions in non-production environments
const isProduction =
	process.env['NODE_ENV'] === 'production' ||
	process.env['FUNCTIONS_EMULATOR'] !== 'true';

if (!isProduction) {
	/**
	 * Seeds the database with test parameters
	 * @param scenario - The test scenario to seed
	 */
	exports.testSeedScenario = onCall(
		{ enforceAppCheck: false },
		async (request) => {
			const { seedTestScenario } = await import('./fn/testHelpers');
			const scenario =
				typeof request.data === 'object' &&
				request.data !== null &&
				'scenario' in request.data
					? ((request.data as { scenario?: string }).scenario ??
						'default')
					: 'default';
			await seedTestScenario(scenario);
			return { success: true };
		},
	);

	/**
	 * Seeds public parameters with custom values
	 * @param params - The parameters to seed
	 */
	exports.testSeedPublicParameters = onCall(
		{ enforceAppCheck: false },
		async (request) => {
			const { seedPublicParameters } = await import('./fn/testHelpers');
			await seedPublicParameters(
				typeof request.data === 'object' && request.data !== null
					? request.data
					: {},
			);
			return { success: true };
		},
	);

	/**
	 * Clears all test data from Firestore and Auth
	 * WARNING: This will delete all data in the emulator
	 */
	exports.testClearAllData = onCall({ enforceAppCheck: false }, async () => {
		const { clearAllData } = await import('./fn/testHelpers');
		await clearAllData();
		return { success: true };
	});
}
