import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
	COLLECTION_SCHEMA,
	isCustomerLanguage,
	type UpdatePreferredLanguageRequest,
} from '@santashop/models';
import admin from '../firebase-admin';
import {
	requireAuthenticatedUid,
	requireCallableData,
	withCallableValidation,
} from '../utility/callable-validation';

export default async function updatePreferredLanguage(
	request: CallableRequest<UpdatePreferredLanguageRequest>,
): Promise<void> {
	const uid = requireAuthenticatedUid(request);
	const language = withCallableValidation(() => {
		const data = requireCallableData(request.data);
		if (!isCustomerLanguage(data['preferredLanguage']))
			throw new HttpsError(
				'invalid-argument',
				'Language must be en or es.',
			);
		return data['preferredLanguage'];
	});
	const reference = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.users}/${uid}`);
	await admin.firestore().runTransaction(async (transaction) => {
		if (!(await transaction.get(reference)).exists)
			throw new HttpsError('not-found', 'Customer profile not found.');
		transaction.set(
			reference,
			{ preferredLanguage: language },
			{ merge: true },
		);
	});
}
