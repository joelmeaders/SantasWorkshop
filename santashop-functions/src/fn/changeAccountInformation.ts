import { ChangeUserInfo, COLLECTION_SCHEMA } from '../../../santashop-models/src/public-api';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { CallableContext, HttpsError } from 'firebase-functions/v1/https';


admin.initializeApp();

export default async (
	data: ChangeUserInfo,
	context: CallableContext
): Promise<boolean | HttpsError> => {
	const uid = context.auth?.uid;

	if (!uid) throw new HttpsError('not-found', 'uid null');

	if (!data || !data.firstName || !data.lastName || !data.zipCode)
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

	return batch
		.commit()
		.then(() => true)
		.catch((error: any) => {
			console.error(
				`Error updating user document ${uid} with ${JSON.stringify(
					data
				)}`,
				error
			);
			return new functions.https.HttpsError(
				'internal',
				'Error updating user document',
				JSON.stringify(error)
			);
		});
};
