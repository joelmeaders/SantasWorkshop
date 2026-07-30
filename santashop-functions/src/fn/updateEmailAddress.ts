import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { Auth, COLLECTION_SCHEMA } from '../models';
import admin from '../firebase-admin';
import { createFunctionLogger } from '../utility/observability';
import { serializeError } from '../utility/errors';

const log = createFunctionLogger('updateEmailAddress');

export default async function updateEmailAddress(
	request: CallableRequest<Auth>,
): Promise<boolean | HttpsError> {
	const data = request.data;
	const uid = request.auth?.uid;

	if (!uid) {
		throw new HttpsError('not-found', 'uid null');
	}

	await admin.auth().updateUser(uid, {
		email: data.emailAddress.toLowerCase(),
	});

	const docData = {
		emailAddress: data.emailAddress.toLowerCase(),
	};

	const batch = admin.firestore().batch();

	const userDocumentRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.users}/${uid}`);

	batch.set(userDocumentRef, docData, { merge: true });

	const indexDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrationSearchIndex}/${uid}`);

	batch.set(indexDocRef, docData, { merge: true });

	const registrationDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);

	batch.set(registrationDocRef, docData, { merge: true });

	try {
		await batch.commit();
		return true;
	} catch (error) {
		log.error(
			'Failed to update email address',
			{
				uid,
				previousEmailAddress:
					typeof request.auth?.token.email === 'string'
						? request.auth.token.email
						: null,
				nextEmailAddress: data.emailAddress,
			},
			error,
		);
		throw new HttpsError(
			'internal',
			`Error updating email address for ${request.auth?.token.email} to ${data.emailAddress}`,
			serializeError(error),
		);
	}
}
