import { COLLECTION_SCHEMA, UpdateReferredBy } from '../models';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import { serializeError } from '../utility/errors';

export default async function updateReferredBy(
	request: CallableRequest<UpdateReferredBy>,
): Promise<boolean | HttpsError> {
	const data = request.data;
	const uid = request.auth?.uid;
	if (!uid) throw new HttpsError('not-found', 'uid null');

	if (!data?.referredBy)
		throw new HttpsError('data-loss', 'missing request information');

	const userDocumentRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.users}/${uid}`);

	try {
		await userDocumentRef.update({ referredBy: data.referredBy });
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
