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
	SIGNUP_MIN_INSTANCES,
	EVENT_MIN_INSTANCES,
	FUNCTIONS_SERVICE_ACCOUNT,
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
const DEPLOYED_SIGNUP_MIN_INSTANCES = RUNNING_IN_FUNCTIONS_EMULATOR
	? 0
	: SIGNUP_MIN_INSTANCES;
const DEPLOYED_EVENT_MIN_INSTANCES = RUNNING_IN_FUNCTIONS_EMULATOR
	? 0
	: EVENT_MIN_INSTANCES;
const MANAGED_RESOURCE_LABELS: Record<string, string> = {
	'santashop-resource-revision': '2026-09-01',
};

const STANDARD_CUSTOMER_OPTIONS = {
	enforceAppCheck: ENFORCE_APP_CHECK,
	memory: '256MiB' as const,
	cpu: 1 as const,
	concurrency: 10,
	maxInstances: 5,
	minInstances: 0,
	timeoutSeconds: 60,
};
const SIGNUP_DRAFT_OPTIONS = {
	...STANDARD_CUSTOMER_OPTIONS,
	concurrency: 20,
	maxInstances: 10,
	timeoutSeconds: 30,
};
const SIGNUP_COMPLETION_OPTIONS = {
	...STANDARD_CUSTOMER_OPTIONS,
	concurrency: 20,
	maxInstances: 10,
	minInstances: DEPLOYED_SIGNUP_MIN_INSTANCES,
};
const NEW_ACCOUNT_OPTIONS = {
	...STANDARD_CUSTOMER_OPTIONS,
	memory: '512MiB' as const,
	maxInstances: 10,
	minInstances: DEPLOYED_SIGNUP_MIN_INSTANCES,
};
const EVENT_HOT_PATH_OPTIONS = {
	...STANDARD_CUSTOMER_OPTIONS,
	concurrency: 20,
	maxInstances: 5,
	minInstances: DEPLOYED_EVENT_MIN_INSTANCES,
	timeoutSeconds: 30,
};
const EVENT_STANDARD_OPTIONS = {
	...STANDARD_CUSTOMER_OPTIONS,
	maxInstances: 3,
	timeoutSeconds: 30,
};
const LOW_VOLUME_OPTIONS = {
	enforceAppCheck: ENFORCE_APP_CHECK,
	memory: '256MiB' as const,
	cpu: 'gcf_gen1' as const,
	concurrency: 1,
	maxInstances: 3,
	minInstances: 0,
	timeoutSeconds: 60,
};

setGlobalOptions({
	region: FUNCTION_REGION,
	...(FUNCTIONS_SERVICE_ACCOUNT
		? { serviceAccount: FUNCTIONS_SERVICE_ACCOUNT }
		: {}),
});

export const changeAccountInformation = onCall(
	STANDARD_CUSTOMER_OPTIONS,
	observeCallableHandler('changeAccountInformation', async (request) => {
		return (await import('./fn/changeAccountInformation')).default(request);
	}),
);

export const updateReferredBy = onCall(
	STANDARD_CUSTOMER_OPTIONS,
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
	SIGNUP_COMPLETION_OPTIONS,
	observeCallableHandler('completeRegistration', async (request) => {
		return (await import('./fn/completeRegistration')).default(request);
	}),
);

export const saveDraftChild = onCall(
	SIGNUP_DRAFT_OPTIONS,
	observeCallableHandler('saveDraftChild', async (request) => {
		return (await import('./fn/saveDraftChild')).default(request);
	}),
);

export const deleteDraftChild = onCall(
	SIGNUP_DRAFT_OPTIONS,
	observeCallableHandler('deleteDraftChild', async (request) => {
		return (await import('./fn/deleteDraftChild')).default(request);
	}),
);

export const setDraftAppointment = onCall(
	SIGNUP_DRAFT_OPTIONS,
	observeCallableHandler('setDraftAppointment', async (request) => {
		return (await import('./fn/setDraftAppointment')).default(request);
	}),
);

export const newAccount = onCall(
	NEW_ACCOUNT_OPTIONS,
	observeCallableHandler('newAccount', async (request) => {
		return (await import('./fn/newAccount')).default(request);
	}),
);

export const undoRegistration = onCall(
	STANDARD_CUSTOMER_OPTIONS,
	observeCallableHandler('undoRegistration', async (request) => {
		return (await import('./fn/undoRegistration')).default(request);
	}),
);

export const changeRegistrationDateTime = onCall(
	STANDARD_CUSTOMER_OPTIONS,
	observeCallableHandler('changeRegistrationDateTime', async (request) => {
		return (await import('./fn/changeRegistrationDateTime')).default(
			request,
		);
	}),
);

export const updateEmailAddress = onCall(
	STANDARD_CUSTOMER_OPTIONS,
	observeCallableHandler('updateEmailAddress', async (request) => {
		return (await import('./fn/updateEmailAddress')).default(request);
	}),
);

export const checkIn = onCall(
	EVENT_HOT_PATH_OPTIONS,
	observeCallableHandler('checkIn', async (request) => {
		return (await import('./fn/checkIn')).default(request);
	}),
);

export const resolveRegistrationScan = onCall(
	EVENT_HOT_PATH_OPTIONS,
	observeCallableHandler('resolveRegistrationScan', async (request) => {
		return (await import('./fn/resolveRegistrationScan')).default(request);
	}),
);

export const checkInWithEdit = onCall(
	EVENT_STANDARD_OPTIONS,
	observeCallableHandler('checkInWithEdit', async (request) => {
		return (await import('./fn/checkInWithEdit')).default(request);
	}),
);

export const onSiteRegistration = onCall(
	EVENT_STANDARD_OPTIONS,
	observeCallableHandler('onSiteRegistration', async (request) => {
		return (await import('./fn/onSiteRegistration')).default(request);
	}),
);

export const callableAdminPreRegister = onCall(
	EVENT_STANDARD_OPTIONS,
	observeCallableHandler('callableAdminPreRegister', async (request) => {
		return (await import('./fn/callableAdminPreRegister')).default(request);
	}),
);

export const callableResendRegistrationEmail = onCall(
	{ ...LOW_VOLUME_OPTIONS, maxInstances: 2 },
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
	LOW_VOLUME_OPTIONS,
	observeCallableHandler('callableListEmailTemplates', async (request) => {
		return (await import('./fn/callableListEmailTemplates')).default(
			request,
		);
	}),
);

export const callableGetEmailTemplate = onCall(
	LOW_VOLUME_OPTIONS,
	observeCallableHandler('callableGetEmailTemplate', async (request) => {
		return (await import('./fn/callableGetEmailTemplate')).default(request);
	}),
);

export const callableGetEmailTemplateRevision = onCall(
	LOW_VOLUME_OPTIONS,
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
	LOW_VOLUME_OPTIONS,
	observeCallableHandler(
		'callableSaveEmailTemplateRevision',
		async (request) => {
			return (
				await import('./fn/callableSaveEmailTemplateRevision')
			).default(request);
		},
	),
);

export const callableDeleteEmailTemplate = onCall(
	LOW_VOLUME_OPTIONS,
	observeCallableHandler('callableDeleteEmailTemplate', async (request) => {
		return (await import('./fn/callableDeleteEmailTemplate')).default(request);
	}),
);

export const callablePublishEmailTemplate = onCall(
	LOW_VOLUME_OPTIONS,
	observeCallableHandler('callablePublishEmailTemplate', async (request) => {
		return (await import('./fn/callablePublishEmailTemplate')).default(
			request,
		);
	}),
);

export const callableSendTestEmailTemplate = onCall(
	LOW_VOLUME_OPTIONS,
	observeCallableHandler('callableSendTestEmailTemplate', async (request) => {
		return (await import('./fn/callableSendTestEmailTemplate')).default(
			request,
		);
	}),
);

export const callableCreateStaffUser = onCall(
	LOW_VOLUME_OPTIONS,
	observeCallableHandler('callableCreateStaffUser', async (request) => {
		return (await import('./fn/callableCreateStaffUser')).default(request);
	}),
);

export const callableUpdateStaffUser = onCall(
	LOW_VOLUME_OPTIONS,
	observeCallableHandler('callableUpdateStaffUser', async (request) => {
		return (await import('./fn/callableUpdateStaffUser')).default(request);
	}),
);

export const callableDeleteStaffUser = onCall(
	LOW_VOLUME_OPTIONS,
	observeCallableHandler('callableDeleteStaffUser', async (request) => {
		return (await import('./fn/callableDeleteStaffUser')).default(request);
	}),
);

export const callablePreviewOwnerOperation = onCall(
	{ ...LOW_VOLUME_OPTIONS, timeoutSeconds: 120 },
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
	LOW_VOLUME_OPTIONS,
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
	LOW_VOLUME_OPTIONS,
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
	LOW_VOLUME_OPTIONS,
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
		labels: MANAGED_RESOURCE_LABELS,
		invoker: 'private',
		maxInstances: 1,
		concurrency: 1,
		memory: '512MiB',
		cpu: 1,
		minInstances: 0,
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
		labels: MANAGED_RESOURCE_LABELS,
		document: 'tmp_registrationemails/{docId}',
		retry: true,
		memory: '256MiB',
		cpu: 1,
		concurrency: 5,
		maxInstances: 2,
		minInstances: 0,
		timeoutSeconds: 120,
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
		labels: MANAGED_RESOURCE_LABELS,
		schedule: SCHEDULED_FIRESTORE_BACKUP,
		timeZone: SHOP_TIME_ZONE,
		memory: '256MiB',
		cpu: 'gcf_gen1',
		concurrency: 1,
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
		labels: MANAGED_RESOURCE_LABELS,
		schedule: SCHEDULED_DATETIME_SLOT_COUNTERS,
		timeZone: SHOP_TIME_ZONE,
		memory: '128MiB',
		cpu: 'gcf_gen1',
		concurrency: 1,
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
		labels: MANAGED_RESOURCE_LABELS,
		schedule: SCHEDULED_REGISTRATION_STATS,
		timeZone: SHOP_TIME_ZONE,
		memory: '256MiB',
		cpu: 'gcf_gen1',
		concurrency: 1,
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
		labels: MANAGED_RESOURCE_LABELS,
		schedule: SCHEDULED_USER_STATS,
		timeZone: SHOP_TIME_ZONE,
		memory: '256MiB',
		cpu: 'gcf_gen1',
		concurrency: 1,
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
		labels: MANAGED_RESOURCE_LABELS,
		schedule: SCHEDULED_CHECKIN_STATS,
		timeZone: SHOP_TIME_ZONE,
		memory: '256MiB',
		cpu: 'gcf_gen1',
		concurrency: 1,
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

const emulatorOnly = <TFunction>(
	createFunction: () => TFunction,
): TFunction | undefined =>
	RUNNING_IN_FUNCTIONS_EMULATOR ? createFunction() : undefined;

/**
 * Seeds the database with test parameters.
 * Emulator only.
 */
export const testSeedScenario = emulatorOnly(() => onCall(
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
));

/**
 * Seeds public parameters with custom values.
 * Emulator only.
 */
export const testSeedPublicParameters = emulatorOnly(() => onCall(
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
));

/**
 * Clears all test data from Firestore and Auth.
 * Emulator only.
 */
export const testClearAllData = emulatorOnly(() => onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testClearAllData', async () => {
		assertEmulatorOnly();

		const { clearAllData } = await import('./fn/testHelpers');
		await clearAllData();
		return { success: true };
	}),
));

/**
 * Seeds an admin auth user with custom admin claims.
 * Emulator only.
 */
export const testSeedAdminUser = emulatorOnly(() => onCall(
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
		const roles = Array.isArray((data as { roles?: unknown }).roles)
			? ((data as { roles: unknown[] }).roles.filter(
					(role): role is 'admin' | 'checkin' =>
						role === 'admin' || role === 'checkin',
				) as ('admin' | 'checkin')[])
			: undefined;

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
			roles,
		});
	}),
));

/**
 * Seeds date/time slots for e2e schedule-editor tests.
 * Emulator only.
 */
export const testSeedDateTimeSlots = emulatorOnly(() => onCall(
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
));

/**
 * Seeds submitted-registration lookup index documents for e2e search tests.
 * Emulator only.
 */
export const testSeedRegistrationSearchIndex = emulatorOnly(() => onCall(
	{ enforceAppCheck: false },
	observeCallableHandler(
		'testSeedRegistrationSearchIndex',
		async (request) => {
			assertEmulatorOnly();

			const { seedRegistrationSearchIndex } = await import(
				'./fn/testHelpers'
			);
			const data =
				typeof request.data === 'object' && request.data !== null
					? request.data
					: {};
			const records = Array.isArray(
				(data as { records?: unknown[] }).records,
			)
				? ((data as { records: unknown[] }).records as {
						id?: string;
						firstName: string;
						lastName: string;
						emailAddress: string;
						customerId: string;
						zip: string;
						code?: string;
					}[])
				: [];

			return seedRegistrationSearchIndex(records);
		},
	),
));

/** Seeds a complete registration for E2E operational flows. Emulator only. */
export const testSeedRegistration = emulatorOnly(() => onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testSeedRegistration', async (request) => {
		assertEmulatorOnly();
		if (typeof request.data !== 'object' || request.data === null) {
			throw new HttpsError('invalid-argument', 'Registration seed is required.');
		}
		const { seedRegistration } = await import('./fn/testHelpers');
		await seedRegistration(request.data as Parameters<typeof seedRegistration>[0]);
		return { success: true };
	}),
));

/** Reads registration QR lifecycle evidence for browser E2E assertions. Emulator only. */
export const testInspectRegistrationQrLifecycle = emulatorOnly(() => onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testInspectRegistrationQrLifecycle', async (request) => {
		assertEmulatorOnly();
		const data = typeof request.data === 'object' && request.data !== null
			? request.data as { emailAddress?: unknown }
			: {};
		if (typeof data.emailAddress !== 'string' || !data.emailAddress.trim()) {
			throw new HttpsError('invalid-argument', 'Email address is required.');
		}
		const { inspectRegistrationQrLifecycle } = await import('./fn/testHelpers');
		return inspectRegistrationQrLifecycle(data.emailAddress);
	}),
));

/** Reads display-safe scan audit attempts and risk summaries. Emulator only. */
export const testInspectRegistrationScanAudit = emulatorOnly(() => onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testInspectRegistrationScanAudit', async (request) => {
		assertEmulatorOnly();
		const data = typeof request.data === 'object' && request.data !== null
			? request.data as { emailAddress?: unknown }
			: {};
		if (typeof data.emailAddress !== 'string' || !data.emailAddress.trim()) {
			throw new HttpsError('invalid-argument', 'Email address is required.');
		}
		const { inspectRegistrationScanAudit } = await import('./fn/testHelpers');
		return inspectRegistrationScanAudit(data.emailAddress);
	}),
));

/** Reads queued registration-email path snapshots. Emulator only. */
export const testInspectQueuedRegistrationEmails = emulatorOnly(() => onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testInspectQueuedRegistrationEmails', async (request) => {
		assertEmulatorOnly();
		const data = typeof request.data === 'object' && request.data !== null
			? request.data as { emailAddress?: unknown }
			: {};
		if (typeof data.emailAddress !== 'string' || !data.emailAddress.trim()) {
			throw new HttpsError('invalid-argument', 'Email address is required.');
		}
		const { inspectQueuedRegistrationEmails } = await import('./fn/testHelpers');
		return inspectQueuedRegistrationEmails(data.emailAddress);
	}),
));

/** Seeds current/prior-season paginated scan-risk fixtures. Emulator only. */
export const testSeedScanRiskHistory = emulatorOnly(() => onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testSeedScanRiskHistory', async (request) => {
		assertEmulatorOnly();
		if (typeof request.data !== 'object' || request.data === null) {
			throw new HttpsError('invalid-argument', 'Scan-risk seed is required.');
		}
		const { seedScanRiskHistory } = await import('./fn/testHelpers');
		await seedScanRiskHistory(request.data as Parameters<typeof seedScanRiskHistory>[0]);
		return { success: true };
	}),
));

/**
 * Seeds a schedule statistics document for reporting E2E tests.
 * Emulator only.
 */
export const testSeedScheduleStats = emulatorOnly(() => onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testSeedScheduleStats', async (request) => {
		assertEmulatorOnly();

		const { seedScheduleStats } = await import('./fn/testHelpers');
		const data =
			typeof request.data === 'object' && request.data !== null
				? (request.data as {
						programYear?: unknown;
						dateTimeCounts?: unknown;
					})
				: {};
		if (!Number.isInteger(data.programYear) || !Array.isArray(data.dateTimeCounts)) {
			throw new HttpsError(
				'invalid-argument',
				'programYear and dateTimeCounts are required.',
			);
		}

		await seedScheduleStats({
			programYear: data.programYear,
			dateTimeCounts: data.dateTimeCounts as {
				dateTime: string;
				count: number;
			}[],
		});
		return { success: true };
	}),
));

/** Seeds registration, check-in, and user statistics documents for reporting E2E tests. */
export const testSeedReportingStats = emulatorOnly(() => onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testSeedReportingStats', async (request) => {
		assertEmulatorOnly();
		if (typeof request.data !== 'object' || request.data === null) {
			throw new HttpsError('invalid-argument', 'Reporting seed is required.');
		}

		const data = request.data as {
			registration?: unknown;
			checkIn?: unknown;
			user?: unknown;
		};
		const {
			seedRegistrationStats,
			seedCheckInStats,
			seedUserStats,
		} = await import('./fn/testHelpers');

		if (data.registration) {
			await seedRegistrationStats(
				data.registration as Parameters<typeof seedRegistrationStats>[0],
			);
		}
		if (data.checkIn) {
			await seedCheckInStats(
				data.checkIn as Parameters<typeof seedCheckInStats>[0],
			);
		}
		if (data.user) {
			await seedUserStats(
				data.user as Parameters<typeof seedUserStats>[0],
			);
		}

		return { success: true };
	}),
));

/**
 * Marks an emulator customer as checked in for customer E2E tests.
 * Emulator only.
 */
export const testSeedCheckIn = emulatorOnly(() => onCall(
	{ enforceAppCheck: false },
	observeCallableHandler('testSeedCheckIn', async (request) => {
		assertEmulatorOnly();

		const data =
			typeof request.data === 'object' && request.data !== null
				? (request.data as { emailAddress?: unknown })
				: {};
		if (typeof data.emailAddress !== 'string' || !data.emailAddress) {
			throw new HttpsError(
				'invalid-argument',
				'emailAddress is required to seed a check-in',
			);
		}

		const { seedCheckInForEmail } = await import('./fn/testHelpers');
		return seedCheckInForEmail(data.emailAddress);
	}),
));
