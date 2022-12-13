import * as admin from 'firebase-admin';
import { CheckIn } from '@models/*';

admin.initializeApp();

export default async (): Promise<string> => {
	// Load all registrations
	const checkins: CheckIn[] = await loadCheckins();
	if (!checkins.length) return Promise.resolve('No checkins');

	const batchSize = 499;
	let processed = 0;

	do {
		const batchCheckins = checkins.splice(0, batchSize);

		await admin.firestore().runTransaction((transaction) => {
			batchCheckins.forEach((checkin) => {
				const uid = checkin.customerId!.toString();
				const registrationDoc = admin
					.firestore()
					.collection('registrations')
					.doc(uid);

				transaction.set(
					registrationDoc,
					{ hasCheckedIn: true },
					{ merge: true }
				);
			});
			return Promise.resolve();
		});

		processed += batchCheckins.length;
		console.info('Processed ', processed);
	} while (checkins.length > 0);

	return Promise.resolve('Updated registrations');
};

const checkinQuery = () =>
	admin
		.firestore()
		.collection('checkins')
		.where('customerId', '!=', 'onsite');

const loadCheckins = async (): Promise<CheckIn[]> => {
	let allRecords: CheckIn[] = [];

	const snapshotDocs = await checkinQuery().get();

	snapshotDocs.docs.forEach((doc) => {
		const reg = {
			...doc.data(),
		} as CheckIn;

		allRecords = allRecords.concat(reg);
	});

	return allRecords;
};
