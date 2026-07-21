import { ChangeUserInfo, COLLECTION_SCHEMA } from '../models';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import { serializeError } from '../utility/errors';

export default async function changeAccountInformation(
	request: CallableRequest<ChangeUserInfo>,
): Promise<boolean | HttpsError> {
	const data = request.data;
	const uid = request.auth?.uid;

	if (!uid) throw new HttpsError('not-found', 'uid null');

	if (!data?.firstName || !data.lastName || !data.zipCode)
		throw new HttpsError('data-loss', 'missing request information');

	await admin.auth().updateUser(uid, {
		displayName: `${data.firstName} ${data.lastName}`,
	});

	const batch = admin.firestore().batch();

	const userDocumentRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.users}/${uid}`);

	batch.set(userDocumentRef, data, { merge: true });

	const indexDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrationSearchIndex}/${uid}`);

	const indexDoc = {
		firstName: data.firstName.toLowerCase(),
		lastName: data.lastName.toLowerCase(),
		zip: data.zipCode,
	};

	batch.set(indexDocRef, indexDoc, { merge: true });

	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);

	const registrationDoc = {
		firstName: data.firstName,
		lastName: data.lastName,
		zipCode: data.zipCode,
	};

	batch.set(registrationDocRef, registrationDoc, { merge: true });

	try {
		await batch.commit();
		return true;
	} catch (error) {
		console.error(
			`Error updating user document ${uid} with ${JSON.stringify(data)}`,
			error,
		);
		throw new HttpsError(
			'internal',
			'Error updating user document',
			serializeError(error),
		);
	}
}
