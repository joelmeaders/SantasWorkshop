import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { FUNCTION_REGION } from './utility/function-region';
import {
	observeCallableHandler,
	observeDocumentHandler,
	observeScheduledHandler,
} from './utility/observability';
import {
	SCHEDULED_CHECKIN_STATS,
	SCHEDULED_DATETIME_SLOT_COUNTERS,
	SCHEDULED_FIRESTORE_BACKUP,
	SCHEDULED_REGISTRATION_STATS,
	SCHEDULED_USER_STATS,
	SHOP_TIME_ZONE,
} from './utility/runtime-config';

/**
 * App Check is enforced in deployed environments but relaxed when running
 * under the Firebase emulator (`FUNCTIONS_EMULATOR === 'true'`). This allows
 * end-to-end tests to exercise these callables against the emulators without a
 * valid App Check token, while production and other deployed environments keep
 * enforcement enabled.
 */
const RUNNING_IN_FUNCTIONS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';
const SEND_EMAILS_FROM_FUNCTIONS_EMULATOR =
	process.env.SANTASHOP_SEND_EMAILS_FROM_EMULATOR === 'true';
const ENFORCE_APP_CHECK = !RUNNING_IN_FUNCTIONS_EMULATOR;
const EMAIL_DELIVERY_SECRETS =
	RUNNING_IN_FUNCTIONS_EMULATOR && !SEND_EMAILS_FROM_FUNCTIONS_EMULATOR
		? []
		: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];

setGlobalOptions({ region: FUNCTION_REGION });

export const changeAccountInformation = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('changeAccountInformation', async (request) => {
		return (await import('./fn/changeAccountInformation')).default(request);
	}),
);

export const updateReferredBy = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('updateReferredBy', async (request) => {
		return (await import('./fn/updateReferredBy')).default(request);
	}),
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
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('completeRegistration', async (request) => {
		return (await import('./fn/completeRegistration')).default(request);
	}),
);

export const newAccount = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('newAccount', async (request) => {
		return (await import('./fn/newAccount')).default(request);
	}),
);

export const undoRegistration = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('undoRegistration', async (request) => {
		return (await import('./fn/undoRegistration')).default(request);
	}),
);

export const changeRegistrationDateTime = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('changeRegistrationDateTime', async (request) => {
		return (await import('./fn/changeRegistrationDateTime')).default(
			request,
		);
	}),
);

export const updateEmailAddress = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('updateEmailAddress', async (request) => {
		return (await import('./fn/updateEmailAddress')).default(request);
	}),
);

export const checkIn = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('checkIn', async (request) => {
		return (await import('./fn/checkIn')).default(request);
	}),
);

export const checkInWithEdit = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('checkInWithEdit', async (request) => {
		return (await import('./fn/checkInWithEdit')).default(request);
	}),
);

export const onSiteRegistration = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('onSiteRegistration', async (request) => {
		return (await import('./fn/onSiteRegistration')).default(request);
	}),
);

export const callableAdminPreRegister = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('callableAdminPreRegister', async (request) => {
		return (await import('./fn/callableAdminPreRegister')).default(request);
	}),
);

export const callableResendRegistrationEmail = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK, maxInstances: 2, memory: '128MiB' },
	observeCallableHandler(
		'callableResendRegistrationEmail',
		async (request) => {
			return (
				await import('./fn/callableResendRegistrationEmail')
			).default(request);
		},
	),
);

export const callableListEmailTemplates = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('callableListEmailTemplates', async (request) => {
		return (await import('./fn/callableListEmailTemplates')).default(
			request,
		);
	}),
);

export const callableGetEmailTemplate = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('callableGetEmailTemplate', async (request) => {
		return (await import('./fn/callableGetEmailTemplate')).default(request);
	}),
);

export const callableGetEmailTemplateRevision = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler(
		'callableGetEmailTemplateRevision',
		async (request) => {
			return (
				await import('./fn/callableGetEmailTemplateRevision')
			).default(request);
		},
	),
);

export const callableSaveEmailTemplateRevision = onCall(
	{
		enforceAppCheck: ENFORCE_APP_CHECK,
		timeoutSeconds: 60,
		memory: '256MiB',
	},
	observeCallableHandler(
		'callableSaveEmailTemplateRevision',
		async (request) => {
			return (
				await import('./fn/callableSaveEmailTemplateRevision')
			).default(request);
		},
	),
);

export const callablePublishEmailTemplate = onCall(
	{
		enforceAppCheck: ENFORCE_APP_CHECK,
		memory: '256MiB',
		timeoutSeconds: 60,
		secrets: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
	},
	observeCallableHandler('callablePublishEmailTemplate', async (request) => {
		return (await import('./fn/callablePublishEmailTemplate')).default(
			request,
		);
	}),
);

export const callableSendTestEmailTemplate = onCall(
	{
		enforceAppCheck: ENFORCE_APP_CHECK,
		memory: '256MiB',
		timeoutSeconds: 60,
		secrets: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
	},
	observeCallableHandler('callableSendTestEmailTemplate', async (request) => {
		return (await import('./fn/callableSendTestEmailTemplate')).default(
			request,
		);
	}),
);

export const callableCreateStaffUser = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('callableCreateStaffUser', async (request) => {
		return (await import('./fn/callableCreateStaffUser')).default(request);
	}),
);

export const callableUpdateStaffUser = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('callableUpdateStaffUser', async (request) => {
		return (await import('./fn/callableUpdateStaffUser')).default(request);
	}),
);

export const callableDeleteStaffUser = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler('callableDeleteStaffUser', async (request) => {
		return (await import('./fn/callableDeleteStaffUser')).default(request);
	}),
);

export const callablePreviewOwnerOperation = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 120 },
	observeCallableHandler(
		'callablePreviewOwnerOperation',
		async (request) => {
			return (
				await import('./fn/ownerOperations')
			).previewOwnerOperation(request);
		},
	),
);

export const callableStartOwnerOperation = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 60 },
	observeCallableHandler(
		'callableStartOwnerOperation',
		async (request) => {
			return (
				await import('./fn/ownerOperations')
			).startOwnerOperation(request);
		},
	),
);

export const callableGetOwnerOperation = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler(
		'callableGetOwnerOperation',
		async (request) => {
			return (
				await import('./fn/ownerOperations')
			).getOwnerOperation(request);
		},
	),
);

export const callableGetOwnerExportUrl = onCall(
	{ enforceAppCheck: ENFORCE_APP_CHECK },
	observeCallableHandler(
		'callableGetOwnerExportUrl',
		async (request) => {
			return (
				await import('./fn/ownerOperations')
			).getOwnerExportUrl(request);
		},
	),
);

export const ownerOperationWorker = onTaskDispatched(
	{
		invoker: 'private',
		maxInstances: 1,
		concurrency: 1,
		memory: '512MiB',
		timeoutSeconds: 1800,
		retryConfig: {
			maxAttempts: 3,
			minBackoffSeconds: 30,
			maxBackoffSeconds: 300,
			maxDoublings: 3,
			maxRetrySeconds: 3600,
		},
		rateLimits: {
			maxConcurrentDispatches: 1,
			maxDispatchesPerSecond: 1,
		},
	},
	async (request) => {
		await (await import('./fn/ownerOperationWorker')).default(request);
	},
);

// ------------------------------------- TRIGGER FUNCTIONS

export const sendNewRegistrationEmails = onDocumentCreated(
	{
		document: 'tmp_registrationemails/{docId}',
		secrets: EMAIL_DELIVERY_SECRETS,
		retry: true,
		maxInstances: 1,
	},
	observeDocumentHandler('sendNewRegistrationEmails', async (event) => {
		if (!event.data) {
			return;
		}

		if (
			RUNNING_IN_FUNCTIONS_EMULATOR &&
			!SEND_EMAILS_FROM_FUNCTIONS_EMULATOR
		) {
			return;
		}

		await (
			await import('./fn/sendNewRegistrationEmails2')
		).default(event.data, { eventId: event.id });
	}),
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
	observeScheduledHandler('scheduledFirestoreBackup', async () => {
		await (await import('./fn/scheduledFirestoreBackup')).default();
	}),
);

// At every 15th minute in November and December.
export const scheduledDateTimeSlotCounters = onSchedule(
	{
		schedule: SCHEDULED_DATETIME_SLOT_COUNTERS,
		memory: '128MiB',
		timeoutSeconds: 30,
		maxInstances: 1,
	},
	observeScheduledHandler('scheduledDateTimeSlotCounters', async () => {
		await (await import('./fn/scheduledDateTimeSlotCounters2')).default();
	}),
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
	observeScheduledHandler('scheduledRegistrationStats', async () => {
		await (await import('./fn/scheduledRegistrationStats')).default();
	}),
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
	observeScheduledHandler('scheduledUserStats', async () => {
		await (await import('./fn/scheduledUserStats')).default();
	}),
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
	observeScheduledHandler('scheduledCheckInStats', async () => {
		await (await import('./fn/scheduledCheckInStats')).default();
	}),
);

// ------------------------------------- TEST HELPER FUNCTIONS (Emulator Only)
// These functions are only available when running in the Firebase emulator
// They should NOT be deployed to production

const assertEmulatorOnly = (): void => {
	const isRunningInEmulator =
		process.env['FUNCTIONS_EMULATOR'] === 'true' ||
		!!process.env['FIREBASE_EMULATOR_HUB'];

	if (!isRunningInEmulator) {
		throw new HttpsError(
			'failed-precondition',
			'Test helper functions are only available in the Firebase emulator.',
		);
	}
};

/**
 * Seeds the database with test parameters.
 * Emulator only.
 */
export const testSeedScenario = onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testSeedScenario', async (request) => {
		assertEmulatorOnly();

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
	}),
);

/**
 * Seeds public parameters with custom values.
 * Emulator only.
 */
export const testSeedPublicParameters = onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testSeedPublicParameters', async (request) => {
		assertEmulatorOnly();

		const { seedPublicParameters } = await import('./fn/testHelpers');
		await seedPublicParameters(
			typeof request.data === 'object' && request.data !== null
				? request.data
				: {},
		);

		return { success: true };
	}),
);

/**
 * Clears all test data from Firestore and Auth.
 * Emulator only.
 */
export const testClearAllData = onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testClearAllData', async () => {
		assertEmulatorOnly();

		const { clearAllData } = await import('./fn/testHelpers');
		await clearAllData();
		return { success: true };
	}),
);

/**
 * Seeds an admin auth user with custom admin claims.
 * Emulator only.
 */
export const testSeedAdminUser = onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testSeedAdminUser', async (request) => {
		assertEmulatorOnly();

		const { seedAdminUser } = await import('./fn/testHelpers');
		const data =
			typeof request.data === 'object' && request.data !== null
				? request.data
				: {};

		const emailAddress =
			'emailAddress' in data && typeof data.emailAddress === 'string'
				? data.emailAddress
				: 'admin-e2e@test.com';
		const password =
			'password' in data && typeof data.password === 'string'
				? data.password
				: undefined;
		const uid =
			'uid' in data && typeof data.uid === 'string'
				? data.uid
				: undefined;
		const adminClaim =
			'admin' in data && typeof data.admin === 'boolean'
				? data.admin
				: true;
		const ownerClaim =
			'owner' in data && typeof data.owner === 'boolean'
				? data.owner
				: false;

		if (!password) {
			throw new HttpsError(
				'invalid-argument',
				'testSeedAdminUser requires a password.',
			);
		}

		return seedAdminUser({
			emailAddress,
			password,
			uid,
			admin: adminClaim,
			owner: ownerClaim,
		});
	}),
);

/**
 * Seeds date/time slots for e2e schedule-editor tests.
 * Emulator only.
 */
export const testSeedDateTimeSlots = onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testSeedDateTimeSlots', async (request) => {
		assertEmulatorOnly();

		const { seedDateTimeSlots } = await import('./fn/testHelpers');
		const data =
			typeof request.data === 'object' && request.data !== null
				? request.data
				: {};
		const slots = Array.isArray((data as { slots?: unknown[] }).slots)
			? ((data as { slots: unknown[] }).slots as {
					id?: string;
					programYear: number;
					dateTime: string;
					maxSlots: number;
					slotsReserved?: number;
					enabled?: boolean;
					lastUpdated?: string;
				}[])
			: [];

		return seedDateTimeSlots(slots);
	}),
);
