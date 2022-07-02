import * as admin from 'firebase-admin';
import {
	COLLECTION_SCHEMA,
	IRegistration,
} from '../../../santashop-models/src/lib/models';
import * as formatDateTime from 'dateformat';

admin.initializeApp();

export default async (): Promise<void> => {
	// Load completed registrations
	const registrationDocQuery = admin
		.firestore()
		.collection(`${COLLECTION_SCHEMA.registrations}`)
		.where('programYear', '==', 2021)
		.orderBy('registrationSubmittedOn');

	const registrations = await registrationDocQuery
		.get()
		.then((snapshotDocs) => {
			if (snapshotDocs.empty) throw new Error('No registrations');

			const regs: IRegistration[] = [];

			snapshotDocs.forEach((doc) => {
				const registration = {
					uid: doc.id,
					...doc.data(),
				} as IRegistration;

				regs.push(registration);
			});

			return regs;
		});

	const batch = admin.firestore().batch();

	registrations.forEach((registration) => {
		const emailDocRef = admin
			.firestore()
			.doc(
				`${COLLECTION_SCHEMA.tmpResendRegistrationEmails}/${registration.uid}`
			);

		let dateTime: string;

		try {
			dateTime = registration.dateTimeSlot?.dateTime as any as string;

			if (!dateTime) {
				console.error(registration.uid, 'missing datetimeslot');
				return;
			}

			const tmp = new Date(dateTime);
			const dateZ = tmp.toLocaleString('en-US', { timeZone: 'MST' });
			dateTime = formatDateTime.default(dateZ, 'dddd, mmmm d, h:MM TT');
		} catch (err) {
			console.error(registration.uid, err);
			dateTime = registration.dateTimeSlot?.dateTime as any as string;
		}

		const emailDoc = {
			code: registration.qrcode,
			email: registration.emailAddress,
			name: registration.firstName,
			formattedDateTime: dateTime,
		};

		batch.set(emailDocRef, emailDoc, { merge: true });
	});

	await batch.commit();

	return Promise.resolve();
};
