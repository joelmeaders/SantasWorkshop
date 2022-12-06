import * as admin from 'firebase-admin';
import { Registration } from '../../../santashop-models/src/public-api';

admin.initializeApp();

export default async (): Promise<string> => {
	// Load all registrations
	const registrations: Registration[] = await loadRegistrations();
	if (!registrations.length) return Promise.resolve('No registrations');

	const noReminderSent = registrations.filter((e) => !e.reminderEmailSentOn);
	const batchSize = 499;
	let processed = 0;

	do {
		const batchRegs = noReminderSent.splice(0, batchSize);

		await admin.firestore().runTransaction((transaction) => {
			batchRegs.forEach((registration) => {
				const doc = admin
					.firestore()
					.collection('registrations')
					.doc(registration.uid!.toString());

				transaction.set(
					doc,
					{ reminderEmailSentOn: false },
					{ merge: true }
				);
			});
			return Promise.resolve();
		});
		processed += batchRegs.length;
		console.info('Processed ', processed);
	} while (noReminderSent.length > 0);

	return Promise.resolve('Updated registrations');
};

const registrationQuery = () => admin.firestore().collection('registrations');

const loadRegistrations = async (): Promise<Registration[]> => {
	let allRegistrations: Registration[] = [];

	const snapshotDocs = await registrationQuery().get();

	snapshotDocs.docs.forEach((doc) => {
		const reg = {
			uid: doc.id,
			...doc.data(),
		} as Registration;

		if (!reg.reminderEmailSentOn) {
			reg.reminderEmailSentOn = false;
		}

		allRegistrations = allRegistrations.concat(reg);
	});

	return allRegistrations;
};
