import { ChangeUserInfo, COLLECTION_SCHEMA } from '../models';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import { createFunctionLogger } from '../utility/observability';
import { serializeError } from '../utility/errors';
import {
	requireAuthenticatedUid,
	requireCallableData,
	requireTrimmedString,
	requireZipCodeValue,
	throwMappedAuthHttpsError,
	withCallableValidation,
} from '../utility/callable-validation';

const log = createFunctionLogger('changeAccountInformation');

export default async function changeAccountInformation(
	request: CallableRequest<ChangeUserInfo>,
): Promise<boolean> {
	const uid = requireAuthenticatedUid(request);
	const data = withCallableValidation(() => {
		const requestData = requireCallableData(request.data);
		return {
			firstName: requireTrimmedString(
				requestData['firstName'],
				'First name',
			),
			lastName: requireTrimmedString(
				requestData['lastName'],
				'Last name',
			),
			zipCode: requireZipCodeValue(requestData['zipCode']),
		};
	});

	try {
		await admin.auth().updateUser(uid, {
			displayName: `${data.firstName} ${data.lastName}`,
		});
	} catch (error) {
		log.error(
			'Failed to update auth profile during account update',
			{ uid },
			error,
		);
		throwMappedAuthHttpsError(
			error,
			'Unable to update account information.',
		);
	}

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
		log.error(
			'Failed to update account information',
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
