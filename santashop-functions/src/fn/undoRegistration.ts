import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { CallableContext } from 'firebase-functions/v1/https';
import { HttpsError } from 'firebase-functions/v1/auth';
import {
	COLLECTION_SCHEMA,
	DateTimeSlot,
	Registration,
} from '../../../santashop-models/src';

admin.initializeApp();

export default async (
	data: Registration,
	context: CallableContext,
): Promise<boolean | HttpsError> => {
	// If admin, use registration data from input, otherwise use own account
	const isAdmin = context.auth?.token?.admin;
	const uid = isAdmin ? data.uid : context.auth?.uid;
	if (!uid) throw new HttpsError('not-found', 'uid null');

	const batch = admin.firestore().batch();

	const indexDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrationSearchIndex}/${uid}`);

	batch.delete(indexDocRef);

	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);

	const registrationDoc = await registrationDocRef.get().then((snapshot) => {
		if (snapshot.exists) {
			return { ...snapshot.data() } as Registration;
		} else {
			throw new HttpsError(
				'not-found',
				`registration not found for uid ${uid}`,
			);
		}
	});

	registrationDoc.previousDateTimeSlot = {
		...registrationDoc.dateTimeSlot,
	} as DateTimeSlot;

	registrationDoc.includedInCounts = false;
	delete registrationDoc.dateTimeSlot;
	delete registrationDoc.registrationSubmittedOn;

	batch.set(registrationDocRef, registrationDoc);

	return batch
		.commit()
		.then(() => Promise.resolve(true))
		.catch((error: any) => {
			console.error(
				`Error updating user document ${uid} with ${JSON.stringify(
					data,
				)}`,
				error,
			);
			return new functions.https.HttpsError(
				'internal',
				'Error updating user document',
				JSON.stringify(error),
			);
		});
};
