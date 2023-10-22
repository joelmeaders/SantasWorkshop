import { COLLECTION_SCHEMA } from '../../santashop-models/src/public-api';
import * as functions from 'firebase-functions';

export const changeAccountInformation = functions.https.onCall(
	async (request, context) => {
		return (await import('./fn/changeAccountInformation')).default(
			request,
			context
		);
	}
);

export const updateReferredBy = functions.https.onCall(
	async (request, context) => {
		return (await import('./fn/updateReferredBy')).default(
			request,
			context
		);
	}
);

/**
 * Runs a method to validate and complete a user registration record.
 * This process locks down their selected dateTimeSlot, sends an email
 * and sets the submitted timestamp on their record.
 *
 * @remarks
 * registration-email, RegistrationSearchIndex
 */
export const completeRegistration = functions.https.onCall(
	async (request, context) => {
		return (await import('./fn/completeRegistration')).default(
			request,
			context
		);
	}
);

export const newAccount = functions.https.onCall(async (request) => {
	return (await import('./fn/newAccount')).default(request);
});

export const undoRegistration = functions.https.onCall(
	async (request, context) => {
		return (await import('./fn/undoRegistration')).default(
			request,
			context
		);
	}
);

export const updateEmailAddress = functions.https.onCall(
	async (request, context) => {
		return (await import('./fn/updateEmailAddress')).default(
			request,
			context
		);
	}
);

export const checkIn = functions.https.onCall(async (request, context) => {
	return (await import('./fn/checkIn')).default(request, context);
});

export const checkInWithEdit = functions.https.onCall(
	async (request, context) => {
		return (await import('./fn/checkInWithEdit')).default(request, context);
	}
);

export const onSiteRegistration = functions.https.onCall(
	async (request, context) => {
		return (await import('./fn/onSiteRegistration')).default(
			request,
			context
		);
	}
);

/**
 * Validate recaptcha response.
 *
 * @remarks
 * Callable functions need to specify return instead of await
 */
export const verifyRecaptcha2 = functions.https.onCall(async (request) => {
	return (await import('./fn/verifyRecaptcha2')).default(request);
});

// ------------------------------------- TRIGGER FUNCTIONS

export const sendNewRegistrationEmails = functions.firestore
	.document(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/{docId}`)
	.onCreate(async (snapshot) => {
		await (
			await import('./fn/sendNewRegistrationEmails')
		).default(snapshot);
	});

// ------------------------------------- SCHEDULED FUNCTIONS

/**
 * Backs up firestore db every night to storage bucket
 * At 00:00 in November and December
 */
export const scheduledFirestoreBackup = functions.pubsub
	.schedule('0 0 * 11,12 *')
	.onRun(async () => {
		await (await import('./fn/scheduledFirestoreBackup')).default();
	});

// At every 15th minute in November and December.
export const scheduledDateTimeSlotCounters = functions.pubsub
	.schedule('*/15 * * 11,12 *')
	.onRun(async () => {
		await (await import('./fn/scheduledDateTimeSlotCounters')).default();
	});

// At minute 0 past every 6th hour in November and December.
export const scheduledDateTimeSlotReschedules = functions.pubsub
	.schedule('0 */6 * 11,12 *')
	.onRun(async () => {
		await (await import('./fn/scheduledDateTimeSlotReschedules')).default();
	});

	// “At 23:59.” (11:59 PM) every day.
export const scheduledRegistrationStats = functions.pubsub
	.schedule('59 23 * * *')
	.timeZone('America/Denver')
	.onRun(async () => {
		await (await import('./fn/scheduledRegistrationStats')).default();
	});

// At every 5th minute past hour 10, 11, 12, 13, 14, 15, and 16 on day-of-month 8, 9, 11, and 12 in December.
export const scheduledCheckInStats = functions.pubsub
	.schedule('*/5 10,11,12,13,14,15,16 8,9,11,12 12 *')
	.timeZone('America/Denver')
	.onRun(async () => {
		await (await import('./fn/scheduledCheckInStats')).default();
	});

// ------------------------------------- PUBSUB FUNCTIONS
export const pubsubResetCheckInStats = functions.pubsub
	.topic('reset-checkin-stats')
	.onPublish(async () => {
		await (await import('./fn/pubsubResetCheckInStats')).default();
	});

export const pubsubSetAdminRights = functions.pubsub
	.topic('set-admin-rights')
	.onPublish(async () => {
		await (await import('./fn/scheduledSetAdminRights')).default();
	});

export const pubsubQueueReminderDocuments = functions.pubsub
	.topic('queue-reminder-documents')
	.onPublish(async () => {
		await (await import('./fn/pubsubQueueReminderDocuments')).default();
	});

export const pubsubSendReminderEmails = functions.pubsub
	.topic('send-reminder-emails')
	.onPublish(async () => {
		await (await import('./fn/pubsubSendReminderEmails')).default();
	});

export const recalculateAllDateTimeSlots = functions.pubsub
	.topic('recalc-all-slots')
	.onPublish(async () => {
		await (await import('./fn/recalculateAllDateTimeSlots')).default();
	});

export const pubsubUserStats = functions.pubsub
	.topic('user-stats')
	.onPublish(async () => {
		await (await import('./fn/pubsubUserStats')).default();
	});

export const pubsubMarkRegistrationsCheckedIn = functions.pubsub
	.topic('mark-registrations-checked-in')
	.onPublish(async () => {
		await (await import('./fn/pubsubMarkRegistrationsCheckedIn')).default();
	});

export const pubsubExportEmails = functions.pubsub
	.topic('export-emails')
	.onPublish(async () => {
		await (await import('./fn/pubsubExportEmails')).default();
	});

// This method checks for existing dates/times.
// If there are none it adds them
export const pubsubAddDateTimeSlots = functions.pubsub
	.topic('create-datetime-slots')
	.onPublish(async () => {
		await (await import('./fn/pubsubAddDateTimeSlots')).default();
	});

// Deletes all users except for disabled accounts
export const pubsubDeleteUsers = functions.pubsub
	.topic('delete-users')
	.onPublish(async () => {
		await (await import('./fn/pubsubDeleteUsers')).default();
	});
