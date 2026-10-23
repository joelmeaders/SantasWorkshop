import admin from '../firebase-admin';
import type { Timestamp } from 'firebase-admin/firestore';
import {
	COLLECTION_SCHEMA,
	EMAIL_TEMPLATE_KEYS,
	Registration,
} from '../models';
import { formatRegistrationDateTime } from '../utility/date-time-format';
import { createFunctionLogger } from '../utility/observability';

const log = createFunctionLogger('queueReminderEmails');

interface ReminderQueueResult {
	success: number;
	failed: number;
}

type ReminderQueueRegistration = Registration & {
	reminderEmailQueuedOn?: false | Date;
	reminderEmailFailedOn?: false | Date;
	reminderEmailSentOn?: false | Date;
};

interface ReminderEmailDocument {
	registrationUid: string;
	code?: string;
	qrCodeStoragePath: string;
	email?: string;
	name?: string;
	appointmentDateTime: unknown;
	formattedDateTime: string;
	appointmentSlotId?: string;
	templateKey: string;
	queuedOn: Date;
	queueSource: 'scheduled-reminder';
	deliveryRequestedOn: Date;
	deliveryState: 'queued';
}

const shouldQueueReminderEmail = (
	registration: ReminderQueueRegistration,
): boolean => {
	if (!registration.registrationSubmittedOn || registration.cancelledOn) {
		return false;
	}

	if (registration.eventReminderSentOn) {
		return false;
	}

	if (registration.eventReminderQueuedOn) {
		return false;
	}

	if (
		!registration.qrCodeStoragePath ||
		!registration.qrCodeGeneratedOn ||
		registration.qrCodeGenerationFailedOn
	) {
		return false;
	}

	return true;
};

// Both preview and execution use durable event-reminder evidence. Old confirmation
// flags are ambiguous, so they cannot consume the event-reminder allowance.
export async function loadReminderCandidates(
	programYear: number,
): Promise<Registration[]> {
	const db = admin.firestore();
	const [registrations, reminders] = await Promise.all([
		db
			.collection(COLLECTION_SCHEMA.registrations)
			.where('programYear', '==', programYear)
			.get(),
		db
			.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
			.where('templateKey', '==', EMAIL_TEMPLATE_KEYS.eventReminder)
			.get(),
	]);
	const previousRecipients = new Set(
		reminders.docs.map((doc) => doc.data()['registrationUid'] ?? doc.id),
	);
	return registrations.docs
		.map((doc) => doc.data() as Registration)
		.filter(
			(record) =>
				shouldQueueReminderEmail(record) &&
				!previousRecipients.has(record.uid),
		);
}

export default async function queueReminderEmails(
	programYear: number,
): Promise<ReminderQueueResult> {
	try {
		const registrations = await loadReminderCandidates(programYear);

		const result = await queueReminderEmailRecords(registrations);
		log.info('Processed reminder email queue run', {
			candidateCount: registrations.length,
			successCount: result.success,
			failedCount: result.failed,
		});

		return result;
	} catch (err) {
		log.error('Failed to queue reminder emails', undefined, err);
		throw new Error(`Failed to queue reminder emails: ${err}`, {
			cause: err,
		});
	}
}

async function queueReminderEmailRecords(
	registrations: ReminderQueueRegistration[],
): Promise<ReminderQueueResult> {
	let success = 0;
	let failed = 0;

	for (const registration of registrations) {
		const uid = registration.uid;

		if (!uid) {
			failed++;
			continue;
		}

		try {
			const db = admin.firestore();
			const emailDocRef = db
				.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
				.doc();
			const registrationDocRef = db.doc(
				`${COLLECTION_SCHEMA.registrations}/${uid}`,
			);

			const wasQueued = await db.runTransaction(async (transaction) => {
				const registrationSnapshot =
					await transaction.get(registrationDocRef);
				const currentRegistration = registrationSnapshot.data() as
					ReminderQueueRegistration | undefined;

				if (
					!currentRegistration ||
					!shouldQueueReminderEmail(currentRegistration)
				) {
					return false;
				}
				const dateTimeSlot = currentRegistration.dateTimeSlot?.dateTime;
				if (!dateTimeSlot) {
					throw new Error(
						'Registration appointment date/time is unavailable.',
					);
				}
				const emailDoc = buildReminderEmailDocument(
					currentRegistration,
					dateTimeSlot as Timestamp,
				);

				transaction.create(emailDocRef, emailDoc);
				transaction.set(
					registrationDocRef,
					{
						eventReminderQueuedOn: emailDoc.queuedOn,
						eventReminderFailedOn: false,
					},
					{ merge: true },
				);

				return true;
			});

			if (!wasQueued) {
				continue;
			}

			success++;
		} catch (err) {
			const registrationDocRef = admin
				.firestore()
				.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);
			await recordReminderQueueFailure(registrationDocRef).catch(
				(failureWriteError: unknown) => {
					log.error(
						'Failed to record reminder queue failure',
						{ uid },
						failureWriteError,
					);
				},
			);
			log.error('Failed to queue reminder email', { uid }, err);
			failed++;
			continue;
		}
	}

	return { success, failed };
}

async function recordReminderQueueFailure(
	registrationDocRef: ReturnType<ReturnType<typeof admin.firestore>['doc']>,
): Promise<void> {
	await admin.firestore().runTransaction(async (transaction) => {
		const registrationSnapshot = await transaction.get(registrationDocRef);
		const registration = registrationSnapshot.data() as
			ReminderQueueRegistration | undefined;
		if (!registration || !shouldQueueReminderEmail(registration)) {
			return;
		}
		transaction.set(
			registrationDocRef,
			{ eventReminderFailedOn: new Date() },
			{ merge: true },
		);
	});
}

function buildReminderEmailDocument(
	registration: ReminderQueueRegistration,
	dateTimeSlot: Timestamp,
): ReminderEmailDocument {
	const queuedOn = new Date();
	return {
		registrationUid: registration.uid ?? '',
		code: registration.qrcode,
		qrCodeStoragePath: registration.qrCodeStoragePath,
		email: registration.emailAddress,
		name: registration.firstName,
		appointmentDateTime: dateTimeSlot,
		formattedDateTime: formatRegistrationDateTime(dateTimeSlot),
		appointmentSlotId: registration.dateTimeSlot?.id,
		templateKey: EMAIL_TEMPLATE_KEYS.eventReminder,
		queuedOn,
		queueSource: 'scheduled-reminder',
		deliveryRequestedOn: queuedOn,
		deliveryState: 'queued',
	};
}
