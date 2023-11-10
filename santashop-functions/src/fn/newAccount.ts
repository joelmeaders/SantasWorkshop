/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { HttpsError } from 'firebase-functions/v1/https';
import {
	OnboardUser,
	User,
	Registration,
	COLLECTION_SCHEMA,
} from '../../../santashop-models/src';
import { generateId } from '../utility/id-generation';
import { generateQrCode } from '../utility/qrcodes';

admin.initializeApp();

export default async (data: OnboardUser): Promise<string | HttpsError> => {
	const newUserAccount = await admin
		.auth()
		.createUser({
			email: data.emailAddress.toLowerCase(),
			password: data.password,
			disabled: false,
			displayName: `${data.firstName} ${data.lastName}`,
		})
		.catch((error) => {
			console.error(
				`${data.emailAddress}`,
				new Error(JSON.stringify(error)),
			);
			throw handleAuthError(error);
		});

	const acceptedLegal = new Date();

	const user: User = {
		firstName: data.firstName,
		lastName: data.lastName,
		emailAddress: data.emailAddress.toLowerCase(),
		zipCode: data.zipCode,
		acceptedTermsOfService: acceptedLegal,
		acceptedPrivacyPolicy: acceptedLegal,
		version: 1,
		manuallyMigrated: false,
		newsletter: data.newsletter,
	};

	const registration: Registration = {
		uid: newUserAccount.uid,
		firstName: data.firstName,
		lastName: data.lastName,
		emailAddress: data.emailAddress.toLowerCase(),
		zipCode: data.zipCode,
		qrcode: generateId(8),
	};

	const userDocument = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.users}/${newUserAccount.uid}`);

	const registrationDocument = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.registrations}/${newUserAccount.uid}`);

	const batch = admin.firestore().batch();

	batch.create(userDocument, user);
	batch.create(registrationDocument, registration);

	// TODO: This whole file is super shitty and fragile
	return batch
		.commit()
		.then(async () => {
			await generateQrCode(newUserAccount.uid, registration.qrcode!);
		})
		.then(() => {
			return Promise.resolve(newUserAccount.uid);
		})
		.catch((error) => {
			console.error(
				'Error creating account records in batch process',
				error,
			);
			throw new functions.https.HttpsError(
				'internal',
				'Account created but something else went wrong',
				JSON.stringify(error),
			);
		});
};

const handleAuthError = (error: any) => {
	switch (error.code) {
		case 'auth/email-already-exists':
			throw new functions.https.HttpsError(
				'already-exists',
				error.code,
				error.message,
			);
		default:
			throw new functions.https.HttpsError(
				'unknown',
				error.code,
				error.message,
			);
	}
};
