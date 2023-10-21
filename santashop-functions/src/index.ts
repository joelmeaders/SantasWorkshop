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
 * Backs up firestore db every hour to storage bucket
 */
export const scheduledFirestoreBackup = functions.pubsub
	.schedule('every 7 days')
	.onRun(async () => {
		await (await import('./fn/scheduledFirestoreBackup')).default();
	});

// Every 1 min (should be 15)
export const scheduledDateTimeSlotCounters = functions.pubsub
	.schedule('every 15 minutes')
	.onRun(async () => {
		await (await import('./fn/scheduledDateTimeSlotCounters')).default();
	});

export const scheduledDateTimeSlotReschedules = functions.pubsub
	.schedule('every 6 hours')
	.onRun(async () => {
		await (await import('./fn/scheduledDateTimeSlotReschedules')).default();
	});

export const scheduledRegistrationStats = functions.pubsub
	.schedule('59 23 * * *')
	.timeZone('America/Denver')
	.onRun(async () => {
		await (await import('./fn/scheduledRegistrationStats')).default();
	});

// Runs every 5 minutes between 10am-4pm, on the 10th, 11th, 13th, 14th of December
export const scheduledCheckInStats = functions.pubsub
	.schedule('*/5 10,11,12,13,14,15,16 9,10,12,13 12 *')
	.timeZone('America/Denver')
	.onRun(async () => {
		await (await import('./fn/scheduledCheckInStats')).default();
	});

// This method checks for existing dates/times.
// If there are none it adds them
export const scheduledAddDateTimeSlots = functions.pubsub
	.schedule('59 23 * * *')
	.onRun(async () => {
		await (await import('./fn/addDateTimeSlots')).default();
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
	.topic('recalc-all-slots')
	.onPublish(async () => {
		await (await import('./fn/pubsubMarkRegistrationsCheckedIn')).default();
	});
