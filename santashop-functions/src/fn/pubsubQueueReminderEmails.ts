import * as admin from 'firebase-admin';
import { COLLECTION_SCHEMA } from '../../../santashop-models/src';
import * as formatDateTime from 'dateformat';
import { Timestamp } from 'firebase-admin/firestore';

admin.initializeApp();

export default async (): Promise<{ success: number; failed: number }> => {
	let result = { success: 0, failed: 0 };

	try {
		const completedRegistrationsQuery = await admin
			.firestore()
			.collection('registrations')
			.orderBy('registrationSubmittedOn', 'asc')
			.get();

		const allRegistrations: any[] = completedRegistrationsQuery.docs.map(
			(doc) => doc.data(),
		);

		const registrations = allRegistrations.filter(
			(e) => !e.reminderEmailFailed && !e.reminderEmailSent,
		);

		result = await QueueReminderEmails(registrations);

		return Promise.resolve(result);
	} catch (err) {
		console.error(err);
		return Promise.reject(result);
	}
};

async function QueueReminderEmails(
	registrations: any,
): Promise<{ success: number; failed: number }> {
	let success = 0;
	let failed = 0;

	for (const registration of registrations) {
		const uid = registration.uid;

		let dateTime: any;

		try {
			dateTime = registration.dateTimeSlot?.dateTime as any as Timestamp;
			const tmp = dateTime.toDate();
			const dateZ = tmp.toLocaleString('en-US', { timeZone: 'MST' });
			dateTime = formatDateTime.default(dateZ, 'dddd, mmmm d, h:MM TT');

			if (!dateTime) {
				console.error(
					'missing datetimeslot for email queue',
					registration.uid,
				);
				continue;
			}
		} catch (err) {
			console.error(
				'failed to convert date/time for email queue',
				registration.uid,
				err,
			);
			continue;
		}

		const emailDoc = {
			code: registration.qrcode,
			email: registration.emailAddress,
			name: registration.firstName,
			formattedDateTime: dateTime,
			template: 'dscs-event-reminder',
		};

		try {
			const emailDocRef = admin
				.firestore()
				.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${uid}`);

			await emailDocRef.create(emailDoc);

			const registrationDocRef = admin
				.firestore()
				.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);

			await registrationDocRef.set(
				{ reminderEmailSent: new Date() },
				{ merge: true },
			);

			success++;
		} catch (err) {
			console.error('failed to queue email', uid, err);
			failed++;
			continue;
		}
	}

	return { success, failed };
}
