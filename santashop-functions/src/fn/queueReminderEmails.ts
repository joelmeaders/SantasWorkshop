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
	code?: string;
	qrCodeStoragePath: string;
	email?: string;
	name?: string;
	formattedDateTime: string;
	templateKey: string;
	queuedOn: Date;
	queueSource: 'scheduled-reminder';
	deliveryRequestedOn: Date;
	deliveryState: 'queued';
}

const shouldQueueReminderEmail = (
	registration: ReminderQueueRegistration,
): boolean => {
	if (!registration.registrationSubmittedOn) {
		return false;
	}

	if (registration.reminderEmailSentOn) {
		return false;
	}

	if (registration.reminderEmailQueuedOn) {
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

export default async function queueReminderEmails(
	programYear: number,
): Promise<ReminderQueueResult> {
	let result: ReminderQueueResult = { success: 0, failed: 0 };

	try {
		const completedRegistrationsQuery = await admin
			.firestore()
			.collection('registrations')
			.where('programYear', '==', programYear)
			.get();

		const allRegistrations: ReminderQueueRegistration[] =
			completedRegistrationsQuery.docs.map(
				(doc) => doc.data() as ReminderQueueRegistration,
			);

		const registrations = allRegistrations.filter((registration) =>
			shouldQueueReminderEmail(registration),
		);

		result = await queueReminderEmailRecords(registrations);
		log.info('Processed reminder email queue run', {
			candidateCount: registrations.length,
			successCount: result.success,
			failedCount: result.failed,
		});

		return result;
	} catch (err) {
		log.error('Failed to queue reminder emails', undefined, err);
		throw new Error(`Failed to queue reminder emails: ${err}`);
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

		let emailDoc: ReminderEmailDocument;

		try {
			emailDoc = buildReminderEmailDocument(
				registration,
				registration.dateTimeSlot?.dateTime as Timestamp,
			);
		} catch (err) {
			log.error(
				'Failed to format reminder email date/time',
				{ uid: registration.uid ?? null },
				err,
			);
			failed++;
			continue;
		}

		try {
			const emailDocRef = admin
				.firestore()
				.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${uid}`);
			const registrationDocRef = admin
				.firestore()
				.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);

			const wasQueued = await admin
				.firestore()
				.runTransaction(async (transaction) => {
					const [queueSnapshot, registrationSnapshot] =
						await Promise.all([
							transaction.get(emailDocRef),
							transaction.get(registrationDocRef),
						]);
					const currentRegistration = registrationSnapshot.data() as
						| ReminderQueueRegistration
						| undefined;

					if (
						!currentRegistration ||
						!shouldQueueReminderEmail(currentRegistration)
					) {
						return false;
					}

					if (queueSnapshot.exists) {
						transaction.set(
							registrationDocRef,
							{
								reminderEmailQueuedOn: emailDoc.queuedOn,
								reminderEmailFailedOn: false,
							},
							{ merge: true },
						);
						transaction.set(
							emailDocRef,
							{
								queuedOn: emailDoc.queuedOn,
								deliveryRequestedOn:
									emailDoc.deliveryRequestedOn,
								deliveryState: 'queued',
								failedOn: false,
								lastErrorMessage: false,
								lastErrorDetails: false,
							},
							{ merge: true },
						);
						return true;
					}

					transaction.create(emailDocRef, emailDoc);
					transaction.set(
						registrationDocRef,
						{
							reminderEmailQueuedOn: emailDoc.queuedOn,
							reminderEmailFailedOn: false,
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
			await registrationDocRef.set(
				{ reminderEmailFailedOn: new Date() },
				{ merge: true },
			);
			log.error('Failed to queue reminder email', { uid }, err);
			failed++;
			continue;
		}
	}

	return { success, failed };
}

function buildReminderEmailDocument(
	registration: ReminderQueueRegistration,
	dateTimeSlot: Timestamp,
): ReminderEmailDocument {
	return {
		code: registration.qrcode,
		qrCodeStoragePath: registration.qrCodeStoragePath,
		email: registration.emailAddress,
		name: registration.firstName,
		formattedDateTime: formatRegistrationDateTime(dateTimeSlot),
		templateKey: EMAIL_TEMPLATE_KEYS.eventReminder,
		queuedOn: new Date(),
		queueSource: 'scheduled-reminder',
		deliveryRequestedOn: new Date(),
		deliveryState: 'queued',
	};
}
