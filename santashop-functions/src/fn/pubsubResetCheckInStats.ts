import * as admin from 'firebase-admin';
import { CheckIn } from '../../../santashop-models/src/public-api';

admin.initializeApp();

export default async (): Promise<string> => {
	// Load all checkins
	const records: CheckIn[] = await loadCheckIns();
	if (!records.length) return Promise.resolve('No checkins');

	const batchSize = 499;
	let processed = 0;

	do {
		const batchRegs = records.splice(0, batchSize);

		await admin.firestore().runTransaction((transaction) => {
			batchRegs.forEach((record) => {
				const doc = admin
					.firestore()
					.collection('checkins')
					.doc(record.customerId!.toString());

				transaction.set(doc, { inStats: false }, { merge: true });
			});
			return Promise.resolve();
		});
		processed += batchRegs.length;
		console.info('Processed ', processed);
	} while (records.length > 0);

	return Promise.resolve('Reset Checkins');
};

const loadCheckIns = async (): Promise<CheckIn[]> => {
	let allRecords: CheckIn[] = [];

	const snapshotDocs = await admin.firestore().collection('checkins').get();

	snapshotDocs.docs.forEach((doc) => {
		const record = {
			...doc.data(),
			customerId: doc.id,
		} as CheckIn;

		allRecords = allRecords.concat(record);
	});

	return allRecords;
};
