/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as admin from 'firebase-admin';
import {
	Registration,
	RegistrationSearchIndex,
} from '../../../santashop-models/src';

admin.initializeApp();

export default async (): Promise<string> => {
	// Load all registrations
	const registrations: Registration[] = await loadRegistrations();
	if (!registrations.length) return Promise.resolve('No registrations');

	const rsi: RegistrationSearchIndex[] = [];

	registrations.forEach((registration) => {
		try {
			const newRsi: RegistrationSearchIndex = {
				code: registration.qrcode,
				customerId: registration.uid!,
				emailAddress: registration.emailAddress!.toLowerCase(),
				firstName: registration.firstName!.toLowerCase(),
				lastName: registration.lastName!.toLowerCase(),
				zip: registration.zipCode!,
			};
			rsi.push(newRsi);
		} catch {
			// Do nothing
		}
	});

	const batchSize = 499;
	let processed = 0;

	do {
		const batchRegs = rsi.splice(0, batchSize);

		admin.firestore().runTransaction((transaction) => {
			batchRegs.forEach((registration) => {
				if (registration.customerId) {
					const doc = admin
						.firestore()
						.collection('registrationsearchindex')
						.doc(registration.customerId);
					transaction.set(doc, registration, { merge: true });
				}
			});
			return Promise.resolve();
		});
		processed += batchRegs.length;
		console.info('Processed ', processed);
	} while (rsi.length > 0);

	return Promise.resolve('Updated index');
};

const indexQuery = () => admin.firestore().collection('registrations');

const loadRegistrations = async (): Promise<Registration[]> => {
	let allRegistrations: Registration[] = [];

	const snapshotDocs = await indexQuery().get();

	snapshotDocs.docs.forEach((doc) => {
		const slot = {
			...doc.data(),
		} as Registration;

		allRegistrations = allRegistrations.concat(slot);
	});

	return allRegistrations;
};
