import {
	COLLECTION_SCHEMA,
	UpdateReferredBy,
} from '../../../santashop-models/src';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { CallableContext } from 'firebase-functions/lib/common/providers/https';
import { HttpsError } from 'firebase-functions/v1/auth';

admin.initializeApp();

export default async (
	data: UpdateReferredBy,
	context: CallableContext,
): Promise<any | HttpsError> => {
	const uid = context.auth?.uid;
	if (!uid) throw new HttpsError('not-found', 'uid null');

	if (!data?.referredBy)
		throw new HttpsError('data-loss', 'missing request information');

	const userDocumentRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.users}/${uid}`);

	return userDocumentRef
		.update({ referredBy: data.referredBy })
		.then(() => true)
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
