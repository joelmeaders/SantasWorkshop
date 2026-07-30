import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTION_SCHEMA, DateTimeSlot, Registration } from '../models';
import admin from '../firebase-admin';
import { createFunctionLogger } from '../utility/observability';
import { serializeError } from '../utility/errors';

const log = createFunctionLogger('undoRegistration');

export default async function undoRegistration(
	request: CallableRequest<Registration>,
): Promise<boolean | HttpsError> {
	const data = request.data;
	// If admin, use registration data from input, otherwise use own account
	const isAdmin = request.auth?.token?.admin;
	const uid = isAdmin ? data.uid : request.auth?.uid;
	if (!uid) throw new HttpsError('not-found', 'uid null');

	const batch = admin.firestore().batch();

	const indexDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrationSearchIndex}/${uid}`);

	batch.delete(indexDocRef);

	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);

	const snapshot = await registrationDocRef.get();
	if (!snapshot.exists) {
		throw new HttpsError(
			'not-found',
			`registration not found for uid ${uid}`,
		);
	}

	const registrationDoc = { ...snapshot.data() } as Registration;

	registrationDoc.previousDateTimeSlot = {
		...registrationDoc.dateTimeSlot,
	} as DateTimeSlot;

	registrationDoc.includedInCounts = false;
	delete registrationDoc.dateTimeSlot;
	delete registrationDoc.registrationSubmittedOn;

	batch.set(registrationDocRef, registrationDoc);

	try {
		await batch.commit();
		return true;
	} catch (error) {
		log.error(
			'Failed to undo registration',
			{
				uid,
				updatedFields: Object.keys(data ?? {}).sort((left, right) =>
					left.localeCompare(right),
				),
			},
			error,
		);
		throw new HttpsError(
			'internal',
			'Error updating user document',
			serializeError(error),
		);
	}
}
