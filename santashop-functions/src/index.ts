import * as functions from 'firebase-functions/v1';

export const changeAccountInformation = functions
	.runWith({ enforceAppCheck: true })
	.https.onCall(async (request, context) => {
		return (await import('./fn/changeAccountInformation')).default(
			request,
			context,
		);
	});

export const updateReferredBy = functions
	.runWith({ enforceAppCheck: true })
	.https.onCall(async (request, context) => {
		return (await import('./fn/updateReferredBy')).default(
			request,
			context,
		);
	});

/**
 * Runs a method to validate and complete a user registration record.
 * This process locks down their selected dateTimeSlot, sends an email
 * and sets the submitted timestamp on their record.
 *
 * @remarks
 * registration-email, RegistrationSearchIndex
 */
export const completeRegistration = functions
	.runWith({ enforceAppCheck: true })
	.https.onCall(async (request, context) => {
		return (await import('./fn/completeRegistration')).default(
			request,
			context,
		);
	});

export const newAccount = functions
	.runWith({ enforceAppCheck: true })
	.https.onCall(async (request) => {
		return (await import('./fn/newAccount')).default(request);
	});

export const undoRegistration = functions
	.runWith({ enforceAppCheck: true })
	.https.onCall(async (request, context) => {
		return (await import('./fn/undoRegistration')).default(
			request,
			context,
		);
	});

export const updateEmailAddress = functions
	.runWith({ enforceAppCheck: true })
	.https.onCall(async (request, context) => {
		return (await import('./fn/updateEmailAddress')).default(
			request,
			context,
		);
	});

export const checkIn = functions
	.runWith({ enforceAppCheck: true })
	.https.onCall(async (request, context) => {
		return (await import('./fn/checkIn')).default(request, context);
	});

export const checkInWithEdit = functions
	.runWith({ enforceAppCheck: true })
	.https.onCall(async (request, context) => {
		return (await import('./fn/checkInWithEdit')).default(request, context);
	});

export const onSiteRegistration = functions
	.runWith({ enforceAppCheck: true })
	.https.onCall(async (request, context) => {
		return (await import('./fn/onSiteRegistration')).default(
			request,
			context,
		);
	});

export const callableAdminPreRegister = functions
	.runWith({ enforceAppCheck: true })
	.https.onCall(async (request, context) => {
		return (await import('./fn/callableAdminPreRegister')).default(
			request,
			context,
		);
	});

export const callableResendRegistrationEmail = functions
	.runWith({ enforceAppCheck: true, maxInstances: 2, memory: '128MB' })
	.https.onCall(async (request, context) => {
		return (await import('./fn/callableResendRegistrationEmail')).default(
			request,
			context,
		);
	});

// ------------------------------------- TRIGGER FUNCTIONS

export const sendNewRegistrationEmails = functions
	.runWith({
		secrets: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
		maxInstances: 1,
	})
	.firestore.document('tmp_registrationemails/{docId}')
	.onCreate(async (snapshot) => {
		await (
			await import('./fn/sendNewRegistrationEmails2')
		).default(snapshot);
	});

// ------------------------------------- SCHEDULED FUNCTIONS

/**
 * Backs up firestore db every night to storage bucket
 * At 00:00 in November and December
 */
export const scheduledFirestoreBackup = functions
	.runWith({ memory: '256MB', timeoutSeconds: 240, maxInstances: 1 })
	.pubsub.schedule('0 0 * 11,12 *')
	.onRun(async () => {
		await (await import('./fn/scheduledFirestoreBackup')).default();
	});

// At every 15th minute in November and December.
export const scheduledDateTimeSlotCounters = functions
	.runWith({ memory: '128MB', timeoutSeconds: 30, maxInstances: 1 })
	.pubsub.schedule('*/15 * * 11,12 *')
	.onRun(async () => {
		await (await import('./fn/scheduledDateTimeSlotCounters2')).default();
	});

// “At 23:59.” (11:59 PM) every day.
export const scheduledRegistrationStats = functions
	.runWith({ memory: '256MB', timeoutSeconds: 240, maxInstances: 1 })
	.pubsub.schedule('59 23 * * *')
	.timeZone('America/Denver')
	.onRun(async () => {
		await (await import('./fn/scheduledRegistrationStats')).default();
	});

// “At 23:55.” (11:55 PM) every day in November and December.
export const scheduledUserStats = functions
	.runWith({ memory: '256MB', timeoutSeconds: 60, maxInstances: 1 })
	.pubsub.schedule('55 23 * 11,12 *')
	.onRun(async () => {
		await (await import('./fn/scheduledUserStats')).default();
	});

// At every 5th minute past hour 10, 11, 12, 13, 14, 15, and 16 on day-of-month 8, 9, 11, and 12 in December.
export const scheduledCheckInStats = functions
	.runWith({ memory: '256MB', timeoutSeconds: 60, maxInstances: 1 })
	.pubsub.schedule('*/5 10,11,12,13,14,15,16 13,14,16,17 12 *')
	.timeZone('America/Denver')
	.onRun(async () => {
		await (await import('./fn/scheduledCheckInStats')).default();
	});

// ------------------------------------- PUBSUB FUNCTIONS
export const pubsubResetCheckInStats = functions
	.runWith({ memory: '256MB', timeoutSeconds: 60, maxInstances: 1 })
	.pubsub.topic('reset-checkin-stats')
	.onPublish(async () => {
		await (await import('./fn/pubsubResetCheckInStats')).default();
	});

export const pubsubQueueReminderEmails = functions
	.runWith({ memory: '256MB', timeoutSeconds: 540, maxInstances: 1 })
	.pubsub.topic('queue-reminder-emails')
	.onPublish(async () => {
		await (await import('./fn/pubsubQueueReminderEmails')).default();
	});

export const pubsubSetAdminRights = functions
	.runWith({ memory: '256MB', timeoutSeconds: 60, maxInstances: 1 })
	.pubsub.topic('set-admin-rights')
	.onPublish(async () => {
		await (await import('./fn/pubsubSetAdminRights')).default();
	});

export const pubsubMarkRegistrationsCheckedIn = functions
	.runWith({ memory: '256MB', timeoutSeconds: 60, maxInstances: 1 })
	.pubsub.topic('mark-registrations-checked-in')
	.onPublish(async () => {
		await (await import('./fn/pubsubMarkRegistrationsCheckedIn')).default();
	});

export const pubsubExportMarketingEmails = functions
	.runWith({ memory: '256MB', timeoutSeconds: 60, maxInstances: 1 })
	.pubsub.topic('export-marketing-emails')
	.onPublish(async () => {
		await (await import('./fn/pubsubExportMarketingEmails')).default();
	});

export const pubsubExportRegisteredEmails = functions
	.runWith({ memory: '256MB', timeoutSeconds: 60, maxInstances: 1 })
	.pubsub.topic('export-registered-emails')
	.onPublish(async () => {
		await (await import('./fn/pubsubExportRegisteredEmails')).default();
	});

// This method checks for existing dates/times.
// If there are none it adds them
export const pubsubAddDateTimeSlots = functions
	.runWith({ memory: '256MB', timeoutSeconds: 60, maxInstances: 1 })
	.pubsub.topic('create-datetime-slots')
	.onPublish(async () => {
		await (await import('./fn/pubsubAddDateTimeSlots')).default();
	});

// Deletes all users except for disabled accounts
export const pubsubDeleteUsers = functions
	.runWith({ memory: '256MB', timeoutSeconds: 60, maxInstances: 1 })
	.pubsub.topic('delete-users')
	.onPublish(async () => {
		await (await import('./fn/pubsubDeleteUsers')).default();
	});
